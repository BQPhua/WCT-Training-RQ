#!/usr/bin/env python3
"""
Upscale the sign-in photo 4x with Real-ESRGAN (RealESRGAN_x4plus) and export web sizes.

Not part of the build or CI: run once when the sign-in photo changes.
No PyTorch needed: the official weights are read with a restricted unpickler
(only tensor-rebuild classes are allowed, so the file cannot run code), the
RRDBNet graph is built with `onnx`, and inference runs on onnxruntime (CPU).

  pip install onnx onnxruntime pillow numpy
  curl -LO https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth
  python3 -I scripts/prepare-signin-image.py RealESRGAN_x4plus.pth photo.png public/brand

Writes signin-paradigm-{1420,710}.{avif,webp,jpg} (width in the name).
"""
import io
import pickle
import sys
import zipfile
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
from onnx import TensorProto, helper, numpy_helper
from PIL import Image, ImageFilter

# ---------------------------------------------------------------- weights


def load_state_dict(path: str) -> dict[str, np.ndarray]:
    """Read a PyTorch zip checkpoint into numpy arrays without importing torch."""
    zf = zipfile.ZipFile(path)
    prefix = zf.namelist()[0].split("/")[0]
    dtypes = {"FloatStorage": np.float32, "HalfStorage": np.float16}

    class Storage:
        def __init__(self, kind: str):
            self.kind = kind

    def rebuild_tensor(storage, offset, size, stride, *_):
        arr = storage
        n = int(np.prod(size)) if size else 1
        flat = arr[offset : offset + max(n, 1) + (sum((s - 1) * st for s, st in zip(size, stride)) if size else 0)]
        if not size:
            return flat[:1].reshape(())
        return np.lib.stride_tricks.as_strided(
            flat, shape=size, strides=[s * flat.itemsize for s in stride]
        ).copy()

    class Restricted(pickle.Unpickler):
        def find_class(self, module, name):
            if module == "collections" and name == "OrderedDict":
                import collections

                return collections.OrderedDict
            if module == "torch._utils" and name == "_rebuild_tensor_v2":
                return rebuild_tensor
            if module == "torch" and name in dtypes:
                return Storage(name)
            raise pickle.UnpicklingError(f"blocked: {module}.{name}")

        def persistent_load(self, pid):
            _, storage, key, _location, _numel = pid
            raw = zf.read(f"{prefix}/data/{key}")
            return np.frombuffer(raw, dtype=dtypes[storage.kind])

    obj = Restricted(io.BytesIO(zf.read(f"{prefix}/data.pkl"))).load()
    params = obj.get("params_ema") or obj.get("params") or obj
    return {k: np.asarray(v, dtype=np.float32) for k, v in params.items()}


# ---------------------------------------------------------------- graph


def build_model(w: dict[str, np.ndarray]) -> bytes:
    nodes, inits = [], []
    count = [0]

    def name(base: str) -> str:
        count[0] += 1
        return f"{base}_{count[0]}"

    def conv(x: str, key: str) -> str:
        out = name(key)
        inits.append(numpy_helper.from_array(w[f"{key}.weight"], f"{key}.weight"))
        inits.append(numpy_helper.from_array(w[f"{key}.bias"], f"{key}.bias"))
        nodes.append(helper.make_node("Conv", [x, f"{key}.weight", f"{key}.bias"], [out], pads=[1, 1, 1, 1]))
        return out

    def lrelu(x: str) -> str:
        out = name("lrelu")
        nodes.append(helper.make_node("LeakyRelu", [x], [out], alpha=0.2))
        return out

    def concat(xs: list[str]) -> str:
        out = name("cat")
        nodes.append(helper.make_node("Concat", xs, [out], axis=1))
        return out

    scale02 = numpy_helper.from_array(np.array(0.2, dtype=np.float32), "k02")
    inits.append(scale02)

    def axpy(a: str, b: str) -> str:  # a * 0.2 + b
        m, out = name("mul"), name("add")
        nodes.append(helper.make_node("Mul", [a, "k02"], [m]))
        nodes.append(helper.make_node("Add", [m, b], [out]))
        return out

    def add(a: str, b: str) -> str:
        out = name("add")
        nodes.append(helper.make_node("Add", [a, b], [out]))
        return out

    def rdb(x: str, key: str) -> str:
        x1 = lrelu(conv(x, f"{key}.conv1"))
        x2 = lrelu(conv(concat([x, x1]), f"{key}.conv2"))
        x3 = lrelu(conv(concat([x, x1, x2]), f"{key}.conv3"))
        x4 = lrelu(conv(concat([x, x1, x2, x3]), f"{key}.conv4"))
        x5 = conv(concat([x, x1, x2, x3, x4]), f"{key}.conv5")
        return axpy(x5, x)

    def upsample(x: str) -> str:
        out = name("up")
        if "scales" not in [i.name for i in inits]:
            inits.append(numpy_helper.from_array(np.array([1, 1, 2, 2], dtype=np.float32), "scales"))
        nodes.append(helper.make_node("Resize", [x, "", "scales"], [out], mode="nearest"))
        return out

    feat = conv("input", "conv_first")
    body = feat
    i = 0
    while f"body.{i}.rdb1.conv1.weight" in w:
        out = rdb(rdb(rdb(body, f"body.{i}.rdb1"), f"body.{i}.rdb2"), f"body.{i}.rdb3")
        body = axpy(out, body)
        i += 1
    feat = add(feat, conv(body, "conv_body"))
    feat = lrelu(conv(upsample(feat), "conv_up1"))
    feat = lrelu(conv(upsample(feat), "conv_up2"))
    out = conv(lrelu(conv(feat, "conv_hr")), "conv_last")
    nodes.append(helper.make_node("Identity", [out], ["output"]))

    graph = helper.make_graph(
        nodes,
        "RRDBNet_x4",
        [helper.make_tensor_value_info("input", TensorProto.FLOAT, [1, 3, None, None])],
        [helper.make_tensor_value_info("output", TensorProto.FLOAT, [1, 3, None, None])],
        inits,
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)], ir_version=8)
    onnx.checker.check_model(model)
    return model.SerializeToString()


# ---------------------------------------------------------------- run


def upscale(model: bytes, img: Image.Image) -> Image.Image:
    sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
    x = np.asarray(img.convert("RGB"), dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
    y = sess.run(["output"], {"input": x})[0][0]
    return Image.fromarray((np.clip(y, 0, 1).transpose(1, 2, 0) * 255.0).round().astype(np.uint8))


def main() -> None:
    weights, photo, out_dir = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    out_dir.mkdir(parents=True, exist_ok=True)
    src = Image.open(photo).convert("RGB")
    big = upscale(build_model(load_state_dict(weights)), src)
    # A touch of the plain Lanczos resize keeps fine edges from looking painted.
    lanczos = src.resize(big.size, Image.LANCZOS)
    big = Image.blend(big, lanczos, 0.15).filter(ImageFilter.UnsharpMask(radius=1.2, percent=35, threshold=2))
    for width in (big.width, big.width // 2):
        im = big if width == big.width else big.resize((width, round(big.height * width / big.width)), Image.LANCZOS)
        stem = out_dir / f"signin-paradigm-{width}"
        im.save(f"{stem}.jpg", quality=86, optimize=True, progressive=True)
        im.save(f"{stem}.webp", quality=85, method=6)
        im.save(f"{stem}.avif", quality=60)
        print(f"{stem}.* {im.size}")


if __name__ == "__main__":
    main()
