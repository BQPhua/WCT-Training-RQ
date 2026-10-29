import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the business unit dialog forgets unsaved changes when closed", async ({ browser }) => {
  const page = await signInAs(browser, "lnd1@demo.wct.my");
  await page.goto("admin/organisation");
  const edit = page.getByRole("button", { name: "Edit E&C" });
  await edit.click();
  const hrFinal = page.getByRole("dialog").getByRole("checkbox", { name: /Final approval by HR Head/ });
  await expect(hrFinal).toBeChecked();
  await hrFinal.uncheck();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await edit.click();
  await expect(page.getByRole("dialog").getByRole("checkbox", { name: /Final approval by HR Head/ })).toBeChecked();
});
