import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("with reduced motion, the dashboard is fully visible straight away", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("signin");
  await page.locator('button[data-email="requester@demo.wct.my"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
  const heading = page.getByRole("heading", { level: 1 }).first();
  await expect(heading).toBeVisible();
  await page.waitForTimeout(500);
  const opacity = await page.locator("main").evaluate((m) => {
    let el: Element | null = m.querySelector("h1");
    let min = 1;
    while (el && el !== m.parentElement) {
      min = Math.min(min, Number(getComputedStyle(el).opacity));
      el = el.parentElement;
    }
    return min;
  });
  expect(opacity).toBe(1);
  await ctx.close();
});
