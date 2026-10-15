import { expect, type Browser, type Page } from "@playwright/test";

export async function signInAs(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("signin");
  await page.locator(`button[value="${email}"]`).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return page;
}

export async function decide(page: Page, url: string, kind: "approve") {
  await page.goto(url);
  await page.getByRole("button", { name: "Approve" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved and passed to the next stage")).toBeVisible();
  return kind;
}

/** Opens the sidebar user menu and clicks an item; retries until the page has hydrated. */
export async function userMenuItem(page: Page, name: RegExp) {
  const item = page.getByRole("menuitem", { name });
  await expect(async () => {
    await page.locator("aside button[aria-haspopup]").first().click();
    await expect(item).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await item.click();
}
