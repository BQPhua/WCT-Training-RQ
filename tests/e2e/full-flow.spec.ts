import { expect, test } from "@playwright/test";
import { decide, signInAs } from "./helpers";

test("request → HOD → BU Admin → L&D rejects → resubmit → full approval → PDF + Excel → history", async ({ browser, request }) => {
  // Five people act in turn; on a cold dev server (CI) each page compiles on first visit.
  test.setTimeout(180_000);
  const title = `E2E Fire Warden Training ${Date.now()}`;

  // 1. Requester raises and submits (names typed by hand)
  const req = await signInAs(browser, "requester@demo.wct.my");
  await req.goto("requests/new");
  await expect(req.getByRole("heading", { name: "New Training Requisition" })).toBeVisible();
  await expect(req.getByText("WCT-F-4.18-2")).toHaveCount(0);
  await req.getByLabel("Planned training").check();
  await req.locator("#title").fill(title);
  await req.locator("#objective").fill("Certify fire wardens for the new site office.");
  await req.locator("#relevancy").fill("The site office needs two certified fire wardens per floor.");
  await req.locator("#startDate").fill("2026-12-01");
  await req.locator("#feePerPax").fill("350.00");
  await req.locator("#venue").fill("WCT Tower, Level 12");
  await req.locator("#conductedBy").fill("Bomba Training Centre");
  await req.locator("#candidate-1").fill("Daniel Lim");
  await req.locator("#candidate-2").fill("Aisyah Rahman");
  await req.getByRole("button", { name: "Review & submit" }).click();
  await expect(req.getByRole("dialog").getByText("Training Dates")).toBeVisible();
  await req.getByRole("dialog").getByRole("button", { name: "Submit to HOD" }).click();
  await expect(req).toHaveURL(/\/requests\/[0-9a-f-]{36}\?submitted=1/);
  const url = req.url().replace(/\?.*$/, "");
  await expect(req.getByText("Pending HOD").first()).toBeVisible();

  // 2. HOD approves → BU Admin
  const hod = await signInAs(browser, "hod.land@demo.wct.my");
  await decide(hod, url, "approve");
  await expect(hod.getByText("Pending BU Admin").first()).toBeVisible();

  // 3. BU Admin approves → L&D
  const bua = await signInAs(browser, "buadmin.land@demo.wct.my");
  await decide(bua, url, "approve");
  await expect(bua.getByText("Pending L&D").first()).toBeVisible();

  // 4. L&D rejects: always back to the requester
  const lnd = await signInAs(browser, "lnd1@demo.wct.my");
  await lnd.goto(url);
  await lnd.getByRole("button", { name: "Reject" }).first().click();
  const dlg = lnd.getByRole("dialog");
  await expect(dlg.getByText("Reject and return to requester")).toBeVisible();
  await dlg.locator("#reject-remark").fill("Please attach the provider quotation.");
  await dlg.getByRole("button", { name: "Reject" }).click();
  await expect(lnd.getByText("Returned").first()).toBeVisible();

  // Requester is told; everyone who approved this round is copied
  const sink = await (await request.get("api/dev/flow-sink")).json();
  const rejected = sink.filter((p: { event: string; title: string }) => p.event === "REJECTED" && p.title === title).at(-1);
  expect(rejected.to).toEqual(["requester@demo.wct.my"]);
  expect(rejected.cc).toEqual(expect.arrayContaining(["hod.land@demo.wct.my", "buadmin.land@demo.wct.my"]));

  // 5. Requester amends and resubmits: restarts at HOD
  await req.goto(`${url}/edit`);
  await expect(req.getByText("Please attach the provider quotation.")).toBeVisible();
  await req.locator("#venue").fill("Online (Microsoft Teams)");
  await req.getByRole("button", { name: "Review & resubmit" }).click();
  await req.getByRole("dialog").getByRole("button", { name: "Resubmit" }).click();
  await expect(req.getByText("Pending HOD").first()).toBeVisible();

  // 6. Full approval chain
  await decide(hod, url, "approve");
  await decide(bua, url, "approve");
  await decide(lnd, url, "approve");
  const hr = await signInAs(browser, "hrhead@demo.wct.my");
  await decide(hr, url, "approve");
  await expect(hr.getByText("Approved").first()).toBeVisible();

  // 7. PDF and Excel
  const api = url.replace(/\/requests\//, "/api/requests/");
  const pdf = await hr.request.get(`${api}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const xlsx = await hr.request.get(`${api}/xlsx`);
  expect(xlsx.status()).toBe(200);
  expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");

  // 8. History finds it by candidate name
  await hr.goto(`history?q=${encodeURIComponent("Daniel Lim")}`);
  await expect(hr.getByRole("heading", { name: "Training RQ History" })).toBeVisible();
  await expect(hr.getByRole("table").getByText(title)).toBeVisible();
});

test("name list replaces typed names", async ({ browser }) => {
  const req = await signInAs(browser, "requester@demo.wct.my");
  await req.goto("requests/new");
  await req.locator("#title").fill(`E2E Name list ${Date.now()}`);
  await req.locator("#candidate-1").fill("Someone Typed");
  await req.getByRole("radio", { name: /Upload name list/ }).click();
  await req.getByRole("dialog").getByRole("button", { name: "Switch to name list" }).click();
  await expect(req.locator("#candidate-1")).toHaveCount(0);
  await req.locator('input[type="file"][accept=".xlsx,.xls,.csv"]').setInputFiles({
    name: "names.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Name,Department\nAli,QS\nSiti,Site\n"),
  });
  await expect(req.getByRole("link", { name: "names.csv" })).toBeVisible();
  await req.locator("#participantCount").fill("25");
  await expect(req.getByText("25 ×")).toBeVisible();
});
