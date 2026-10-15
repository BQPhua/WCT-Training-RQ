import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("System Admin views the app as a demo BU Admin, then exits", async ({ browser }) => {
  const admin = await signInAs(browser, "admin@demo.wct.my");
  const item = admin.getByRole("menuitem", { name: /View as demo user/ });
  // The dashboard hydrates after navigation; retry until the menu actually opens.
  await expect(async () => {
    await admin.locator("aside button[aria-haspopup]").first().click();
    await expect(item).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await item.click();
  await admin.getByRole("dialog").getByRole("button", { name: /Lee Mei Ling/ }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Viewing as" })).toContainText("Lee Mei Ling");
  await expect(admin.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Approvals/ })).toBeVisible();
  await expect(admin.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admin settings" })).toHaveCount(0);
  await admin.getByRole("button", { name: "Exit" }).click();
  await expect(admin.getByText("Viewing as")).toHaveCount(0);
  await expect(admin.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admin settings" })).toBeVisible();
});
