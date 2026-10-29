#!/usr/bin/env node
// WCAG contrast check for the colour tokens in src/app/globals.css (light :root and .dark).
// Run: node scripts/check-contrast.mjs  — exits 1 if any required pair falls short.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

/** Token values from the first `selector {` block, e.g. ":root" or ".dark". */
function block(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block`);
  const end = css.indexOf("\n}", start);
  const out = {};
  for (const m of css.slice(start, end).matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function oklchToLinearRgb(l, c, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

function luminance(value) {
  let rgb;
  const ok = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (ok) rgb = oklchToLinearRgb(+ok[1], +ok[2], +ok[3]);
  else if (hex) {
    rgb = [0, 2, 4].map((i) => {
      const v = parseInt(hex[1].slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
  } else throw new Error(`Unsupported colour value: ${value}`);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** [foreground, background, minimum ratio] */
const PAIRS = [
  ["ink", "ground", 4.5],
  ["ink", "surface", 4.5],
  ["ink-2", "surface", 4.5],
  ["muted", "surface", 4.5],
  ["muted", "ground", 4.5],
  ["shell-fg", "shell", 4.5],
  ["shell-muted", "shell", 4.5],
  ["shell-fg", "shell-2", 4.5],
  ["shell-muted", "shell-dusk", 4.5],
  ["brand-fg", "brand", 4.5],
  ["brand-text", "surface", 4.5],
  ["brand", "surface", 3],
  ["info-text", "surface", 4.5],
  ["info-text", "info-soft", 4.5],
  ["st-approved-text", "st-approved-soft", 4.5],
  ["st-pending-text", "st-pending-soft", 4.5],
  ["st-returned-text", "st-returned-soft", 4.5],
  ["st-cancelled-text", "st-cancelled-soft", 4.5],
  ["st-draft-text", "st-draft", 4.5],
  ["danger", "surface", 4.5],
  ["danger", "danger-soft", 4.5],
  ["focus", "surface", 3],
];

const light = block(":root");
const dark = { ...light, ...block(".dark") };
let failed = 0;
for (const [name, tokens] of [["light", light], ["dark", dark]]) {
  for (const [fg, bg, min] of PAIRS) {
    if (!tokens[fg] || !tokens[bg]) {
      console.log(`✗ ${name}: missing token --${!tokens[fg] ? fg : bg}`);
      failed++;
      continue;
    }
    const r = ratio(tokens[fg], tokens[bg]);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`${ok ? "✓" : "✗"} ${name.padEnd(5)} ${fg} on ${bg}: ${r.toFixed(2)} (min ${min})`);
  }
}
if (failed) {
  console.error(`\n${failed} contrast pair(s) below the WCAG minimum.`);
  process.exit(1);
}
console.log("\nAll contrast pairs pass.");
