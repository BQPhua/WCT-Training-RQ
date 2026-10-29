import { expect, test } from "@playwright/test";

test.describe("sign-in page", () => {
  test("1920x1080: photo panel is visible and the rendered image width ≤ its natural width", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto("signin");
    const photo = page.getByTestId("signin-photo");
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
    // With srcset, naturalWidth is density-adjusted, so check which file loaded and use its real size.
    const { src, rendered, renderedH } = await photo.evaluate((img: HTMLImageElement) => {
      // object-fit: cover scales by the larger ratio; layout size, not the brief settle transform at load.
      const scale = Math.max(img.offsetWidth / 1420, img.offsetHeight / 1136);
      return { src: img.currentSrc, rendered: 1420 * scale, renderedH: 1136 * scale };
    });
    expect(src).toMatch(/signin-paradigm-1420\.(avif|webp|jpg)$/);
    expect(rendered).toBeLessThanOrEqual(1420);
    expect(renderedH).toBeLessThanOrEqual(1136);
    await ctx.close();
  });

  test("390x844: the Microsoft sign-in button is within the viewport", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto("signin");
    const button = page.getByRole("link", { name: "Sign in with Microsoft" });
    await expect(button).toBeInViewport();
    await ctx.close();
  });

  test("demo accounts list renders when DEMO_LOGIN=true", async ({ page }) => {
    await page.goto("signin");
    await expect(page.getByRole("region", { name: "Try a demo account" }).getByRole("group", { name: "Requester" })).toContainText("Amir Hakim");
  });
});
