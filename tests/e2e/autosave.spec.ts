import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("draft autosaves and survives a reload", async ({ browser }) => {
  const title = `E2E Autosave ${Date.now()}`;
  const page = await signInAs(browser, "requester@demo.wct.my");
  await page.goto("requests/new");
  await page.locator("#title").fill(title);
  await page.locator("#objective").fill("Saved without pressing Save draft.");
  await expect(page.getByText(/Draft saved automatically/)).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/requests\/[0-9a-f-]{36}\/edit/);
  await page.reload();
  await expect(page.locator("#title")).toHaveValue(title);
  await expect(page.locator("#objective")).toHaveValue("Saved without pressing Save draft.");
});
