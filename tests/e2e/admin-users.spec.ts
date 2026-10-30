import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the Users page shows the Microsoft 365 sync panel, a status filter and sign-in badges", async ({ browser }) => {
  const page = await signInAs(browser, "lnd1@demo.wct.my");
  await page.goto("admin/users");
  const panel = page.getByRole("region", { name: "Microsoft 365 sync" });
  await expect(panel).toContainText("Microsoft 365 sync is off");
  await expect(panel.getByRole("button", { name: "Sync now" })).toBeDisabled();

  await page.getByLabel("Show").selectOption("not-signed-in");
  await expect(page).toHaveURL(/status=not-signed-in/);
  await expect(page.getByRole("table").getByText("Not signed in yet").first()).toBeVisible();
});
