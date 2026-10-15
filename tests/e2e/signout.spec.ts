import { expect, test } from "@playwright/test";
import { signInAs, userMenuItem } from "./helpers";

test("sign out from the user menu ends the session", async ({ browser }) => {
  const page = await signInAs(browser, "requester@demo.wct.my");
  await userMenuItem(page, /Sign out/);
  await expect(page).toHaveURL(/\/signin\?signedout=1/);
  await page.goto("dashboard");
  await expect(page).toHaveURL(/\/signin/);
});
