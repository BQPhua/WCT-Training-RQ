import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("sign out from the user menu ends the session", async ({ browser }) => {
  const page = await signInAs(browser, "requester@demo.wct.my");
  await page.locator("aside button[aria-haspopup]").first().click();
  await page.getByRole("menuitem", { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/signin\?signedout=1/);
  await page.goto("dashboard");
  await expect(page).toHaveURL(/\/signin/);
});
