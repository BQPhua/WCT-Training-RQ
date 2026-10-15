import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("analytics live on the dashboard; Reports nav is gone and /reports redirects", async ({ browser }) => {
  const hr = await signInAs(browser, "hrhead@demo.wct.my");
  await expect(hr.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(hr.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Reports" })).toHaveCount(0);
  await expect(hr.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "New Training Requisition" })).toBeVisible();
  await hr.goto("reports");
  await expect(hr).toHaveURL(/\/dashboard(\?[^#]*)?#analytics$/);
  await expect(hr.getByRole("heading", { name: "Analytics" })).toBeVisible();

  const staff = await signInAs(browser, "requester@demo.wct.my");
  await expect(staff.getByRole("heading", { name: "Analytics" })).toHaveCount(0);
});
