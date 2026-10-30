import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the person picker finds people as you type and is keyboard-operable", async ({ browser }) => {
  const page = await signInAs(browser, "lnd1@demo.wct.my");
  await page.goto("admin/organisation");
  const picker = page.getByRole("combobox", { name: "Add BU Admin to Land" });
  const list = page.getByRole("listbox");
  // Retry the typing until the page has hydrated and the search answers.
  await expect(async () => {
    await picker.fill("");
    await picker.fill("Ha");
    await expect(list.getByRole("option", { name: /Hafiz Osman/ })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await picker.fill("Hafiz");
  await expect(list.getByRole("option")).toHaveCount(1);
  await picker.press("ArrowDown");
  await expect(list.getByRole("option", { name: /Hafiz Osman/ })).toHaveAttribute("aria-selected", "true");
  await picker.press("Enter");
  await expect(picker).toHaveValue("Hafiz Osman");
  await expect(page.getByRole("listbox")).toHaveCount(0);
});
