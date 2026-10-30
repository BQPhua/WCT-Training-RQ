import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the desktop sidebar collapses to an icon rail, remembers it, and expands again", async ({ browser }) => {
  const page = await signInAs(browser, "lnd1@demo.wct.my");
  await page.setViewportSize({ width: 1440, height: 900 });
  const rail = page.locator("aside").first();
  const nav = rail.getByRole("navigation", { name: "Main" });

  await expect(async () => {
    await page.getByRole("button", { name: "Collapse sidebar" }).click({ timeout: 2000 });
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await expect.poll(async () => Math.round((await rail.boundingBox())!.width)).toBe(72);
  // Labels stay for screen readers (sr-only) but take no visible space.
  await expect.poll(async () => (await nav.getByText("Training RQ History").boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
  await expect(nav.getByRole("link", { name: /Approvals/ })).toBeVisible();
  await expect(nav.getByLabel(/awaiting your action/)).toBeVisible();

  await nav.getByRole("link", { name: /Training RQ History/ }).hover();
  await expect(page.getByRole("tooltip")).toContainText("Training RQ History");

  await page.reload();
  await expect.poll(async () => Math.round((await rail.boundingBox())!.width)).toBe(72);

  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(async () => Math.round((await rail.boundingBox())!.width)).toBe(256);
  await expect.poll(async () => (await nav.getByText("Training RQ History").boundingBox())?.width ?? 0).toBeGreaterThan(50);
});
