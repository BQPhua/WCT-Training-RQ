import { expect, test } from "@playwright/test";
import { signInAs, userMenuItem } from "./helpers";

test("System Admin views the app as a demo BU Admin, then exits", async ({ browser }) => {
  const admin = await signInAs(browser, "admin@demo.wct.my");
  await userMenuItem(admin, /View as demo user/);
  await admin.getByRole("dialog").getByRole("button", { name: /Lee Mei Ling/ }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Viewing as" })).toContainText("Lee Mei Ling");
  await expect(admin.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Approvals/ })).toBeVisible();
  await expect(admin.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admin settings" })).toHaveCount(0);
  await admin.getByRole("button", { name: "Exit" }).click();
  await expect(admin.getByText("Viewing as")).toHaveCount(0);
  await expect(admin.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admin settings" })).toBeVisible();
});

test("signing in again clears any view-as left in the browser session", async ({ browser }) => {
  const admin = await signInAs(browser, "admin@demo.wct.my");
  const leeId = await admin.evaluate(async () => {
    const res = await fetch(`${location.pathname.split("/dashboard")[0]}/api/auth/view-as`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: "00000000-0000-0000-0000-000000000000" }) });
    return res.status;
  });
  expect(leeId).toBe(403); // unknown ids are refused
  await userMenuItem(admin, /View as demo user/);
  await admin.getByRole("dialog").getByRole("button", { name: /Lee Mei Ling/ }).click();
  await expect(admin.getByText("Viewing as")).toBeVisible();
  // A new sign-in in the same browser (shared PC) starts clean.
  await admin.request.post("api/auth/dev-login", { form: { email: "admin@demo.wct.my" } });
  await admin.goto("dashboard");
  await expect(admin.getByText("Viewing as")).toHaveCount(0);
});
