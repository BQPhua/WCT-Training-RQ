import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FadeRise, SPRING } from "@/components/motion/fade-rise";
import { Stagger, StaggerItem } from "@/components/motion/stagger";

describe("FadeRise", () => {
  it("renders its children, visible without JavaScript (CSS entrance)", () => {
    const html = renderToStaticMarkup(<FadeRise>Hello</FadeRise>);
    expect(html).toContain("Hello");
    expect(html).toContain("animate-rise");
    expect(html).not.toContain("opacity:0");
  });

  it("passes a delay through as animation-delay", () => {
    expect(renderToStaticMarkup(<FadeRise delay={0.12}>x</FadeRise>)).toContain("animation-delay:120ms");
  });

  it("exports the one spring used for layout motion", () => {
    expect(SPRING).toEqual({ type: "spring", visualDuration: 0.25, bounce: 0 });
  });
});

describe("Stagger", () => {
  const items = Array.from({ length: 10 }, (_, i) => <StaggerItem key={i}>item {i}</StaggerItem>);

  it("animates at most limit items", () => {
    const html = renderToStaticMarkup(<Stagger as="ul" limit={8}>{items}</Stagger>);
    expect(html.startsWith("<ul")).toBe(true);
    expect(html.match(/animate-rise/g)).toHaveLength(8);
    expect(html).toContain("animation-delay:210ms"); // 8th item: 7 × 30ms
    expect(html).toContain("item 9");
  });

  it("defaults to 8 and a div", () => {
    const html = renderToStaticMarkup(<Stagger>{items}</Stagger>);
    expect(html.startsWith("<div")).toBe(true);
    expect(html.match(/animate-rise/g)).toHaveLength(8);
  });
});
