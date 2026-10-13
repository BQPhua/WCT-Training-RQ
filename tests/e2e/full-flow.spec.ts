import { expect, test } from "@playwright/test";
import { decide, signInAs } from "./helpers";

test("request → HOD → L&D sends back → resubmit → full approval → PDF → history", async ({ browser, request }) => {
  const title = `E2E Fire Warden Training ${Date.now()}`;

  // 1. Requester raises and submits
  const req = await signInAs(browser, "requester@demo.wct.my");
  await req.goto("requests/new");
  await req.getByLabel("Planned training").check();
  await req.locator("#title").fill(title);
  await req.locator("#objective").fill("Certify fire wardens for the new site office.");
  await req.locator("#startDate").fill("2026-12-01");
  await req.locator("#feePerPax").fill("350.00");
  await req.locator("#venue").fill("WCT Tower, Level 12");
  await req.locator("#conductedBy").fill("Bomba Training Centre");
  await req.getByRole("combobox", { name: /search staff/i }).fill("Daniel");
  await req.getByRole("option", { name: /Daniel Lim/ }).click();
  await req.getByRole("button", { name: "Review & submit" }).click();
  await req.getByRole("dialog").getByRole("button", { name: "Submit to HOD" }).click();
  await expect(req).toHaveURL(/\/requests\/[0-9a-f-]{36}\?submitted=1/);
  const url = req.url().replace(/\?.*$/, "");
  await expect(req.getByText("Pending HOD").first()).toBeVisible();

  // 2. HOD approves
  const hod = await signInAs(browser, "hod.land@demo.wct.my");
  await decide(hod, url, "approve");
  await expect(hod.getByText("Pending L&D").first()).toBeVisible();

  // 3. L&D rejects back to requester, also notifying HOD
  const lnd = await signInAs(browser, "lnd1@demo.wct.my");
  await lnd.goto(url);
  await lnd.getByRole("button", { name: /Reject & send back/ }).click();
  const dlg = lnd.getByRole("dialog");
  await dlg.getByLabel("Requester").first().check();
  await dlg.getByLabel("Department HOD").last().check();
  await dlg.locator("#reject-remark").fill("Please attach the provider quotation.");
  await dlg.getByRole("button", { name: /Send back to Requester/ }).click();
  await expect(lnd.getByText("Returned").first()).toBeVisible();

  // BU Admin is always told about a rejection
  const sink = await (await request.get("api/dev/flow-sink")).json();
  const rejected = sink.filter((p: { event: string; title: string }) => p.event === "REJECTED" && p.title === title).at(-1);
  expect(rejected.to).toEqual(expect.arrayContaining(["requester@demo.wct.my", "hod.land@demo.wct.my", "buadmin.land@demo.wct.my"]));

  // 4. Requester amends and resubmits
  await req.goto(`${url}/edit`);
  await expect(req.getByText("Please attach the provider quotation.")).toBeVisible();
  await req.locator("#venue").fill("Online (Microsoft Teams)");
  await req.getByRole("button", { name: "Review & resubmit" }).click();
  await req.getByRole("dialog").getByRole("button", { name: "Resubmit" }).click();
  await expect(req.getByText("Pending HOD").first()).toBeVisible();

  // 5. Full approval chain
  await decide(hod, url, "approve");
  await decide(lnd, url, "approve");
  const hr = await signInAs(browser, "hrhead@demo.wct.my");
  await decide(hr, url, "approve");
  await expect(hr.getByText("Approved").first()).toBeVisible();

  // 6. PDF
  const pdf = await hr.request.get(`${url.replace(/\/requests\//, "/api/requests/")}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  // 7. History finds it by candidate name
  await hr.goto(`history?q=${encodeURIComponent("Daniel Lim")}`);
  await expect(hr.getByText(title)).toBeVisible();
});
