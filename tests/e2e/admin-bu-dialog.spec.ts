import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the business unit dialog forgets unsaved changes when closed", async ({ browser }) => {
  const page = await signInAs(browser, "lnd1@demo.wct.my");
  await page.goto("admin/organisation");
  const edit = page.getByRole("button", { name: "Edit E&C" });
  await edit.click();
  const name = page.getByRole("dialog").getByLabel("Name");
  await expect(name).toHaveValue("E&C");
  await name.fill("Something else");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await edit.click();
  await expect(page.getByRole("dialog").getByLabel("Name")).toHaveValue("E&C");
  // The route switches live on the Approval flow tab, not in this dialog.
  await expect(page.getByRole("dialog").getByRole("checkbox", { name: /Final approval by HR Head/ })).toHaveCount(0);
});
