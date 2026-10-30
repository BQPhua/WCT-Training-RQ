import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

const ANALYTICS = { name: "Overview & analytics" } as const;

/** Vertical position of a region, to check the dashboard's top-to-bottom order. */
const top = async (page: Page, name: string) => (await page.getByRole("region", { name }).boundingBox())!.y;

test("analytics come first in one overview bar; availability board is last; /reports redirects", async ({ browser }) => {
  const hr = await signInAs(browser, "hrhead@demo.wct.my");
  await expect(hr.getByRole("heading", ANALYTICS)).toBeVisible();
  const kpis = hr.getByRole("region", { name: "Key figures" });
  await expect(kpis).toContainText("Awaiting your action");
  await expect(kpis).toContainText("Requests submitted");
  await expect(kpis).toContainText("Approved training spend");
  await expect(kpis).toContainText("Requests approved");
  await expect(kpis.getByRole("link")).toHaveCount(2); // personal counters link; year totals don't
  const order = [await top(hr, "Key figures"), await top(hr, "Analytics charts"), await top(hr, "Availability board")];
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  await expect(hr.getByRole("heading", { name: "Recent activity" })).toBeVisible();
  expect(await top(hr, "Availability board")).toBeGreaterThan((await hr.getByRole("heading", { name: "Recent activity" }).boundingBox())!.y);

  await expect(hr.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Reports" })).toHaveCount(0);
  await hr.goto("reports");
  await expect(hr).toHaveURL(/\/dashboard(\?[^#]*)?#analytics$/);
  await expect(hr.getByRole("heading", ANALYTICS)).toBeVisible();

  const staff = await signInAs(browser, "requester@demo.wct.my");
  await expect(staff.getByRole("heading", ANALYTICS)).toHaveCount(0);
  await expect(staff.getByRole("region", { name: "Key figures" })).toContainText("Approved spend");
  await expect(staff.getByRole("region", { name: "Key figures" }).getByRole("link")).toHaveCount(2);
});

test("the sign-in page lists demo accounts by role and signs in as the one picked", async ({ page }) => {
  await page.goto("signin");
  const demo = page.getByRole("region", { name: "Try a demo account" });
  await expect(demo.getByRole("group", { name: "HR Head" })).toContainText("Farah Hanim");
  await expect(demo.getByRole("group", { name: "L&D Team (System Admin)" })).toBeVisible();
  await demo.getByRole("button", { name: "Farah Hanim" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("status").filter({ hasText: "Demo account" })).toContainText("Farah Hanim");
  await page.getByRole("button", { name: "Switch account" }).click();
  await expect(page).toHaveURL(/\/signin\?signedout=1/);
});

test("the L&D team reaches Admin settings, read-only for demo accounts, with Head of Departments and no audit log", async ({ browser }) => {
  const lnd = await signInAs(browser, "lnd1@demo.wct.my");
  await lnd.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admin settings" }).click();
  await expect(lnd.getByRole("note")).toContainText("changes are turned off");
  await lnd.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Business units & departments" }).click();
  await expect(lnd.getByText("Head of Departments")).toBeVisible();
  await expect(lnd.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Audit log" })).toHaveCount(0);
});

test("demo sign-in refuses other sites and real staff accounts", async ({ page, request }) => {
  await page.goto("signin");
  const id = await page.locator('button[data-email="hrhead@demo.wct.my"]').getAttribute("value");
  const evil = await request.post("api/auth/demo-login", { form: { userId: id! }, headers: { Origin: "https://evil.example" }, maxRedirects: 0 });
  expect(evil.status()).toBe(403);
  const noOrigin = await request.post("api/auth/demo-login", { form: { userId: id! }, maxRedirects: 0 });
  expect(noOrigin.status()).toBe(403);
  const origin = new URL(page.url()).origin;
  const bogus = await request.post("api/auth/demo-login", { form: { userId: "00000000-0000-4000-8000-000000000000" }, headers: { Origin: origin }, maxRedirects: 0 });
  expect(bogus.status()).toBe(303);
  expect(bogus.headers()["location"]).toContain("/signin?error=demo_user");
});
