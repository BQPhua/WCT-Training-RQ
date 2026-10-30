import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("the Approval flow tab shows each unit's numbered steps; demo controls are read-only", async ({ browser }) => {
  const page = await signInAs(browser, "lnd1@demo.wct.my");
  await page.goto("admin");
  await expect(page).toHaveURL(/\/admin\/flow/);
  const nav = page.getByRole("navigation", { name: "Admin sections" });
  await expect(nav.getByRole("link").first()).toHaveText("Approval flow");

  const enc = page.getByRole("region", { name: "E&C approval flow" });
  const land = page.getByRole("region", { name: "Land approval flow" });
  await expect(enc.getByRole("listitem")).toHaveText([/1\s*Raise/, /2\s*Department HOD/, /3\s*BU Admin/, /4\s*L&D Team/, /5\s*HR Head/, /Approved/]);
  const step = (name: string) => land.getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });
  await expect(step("HR Head")).toContainText("Skipped");
  await expect(step("L&D Team")).toContainText("Reviews and gives final approval");
  await expect(step("BU Admin")).toContainText("Lee Mei Ling");

  // Demo accounts can look but not change.
  await expect(land.getByRole("switch", { name: "HR Head step" })).toBeDisabled();
  await expect(land.getByRole("button", { name: "Edit descriptions" })).toBeDisabled();
});
