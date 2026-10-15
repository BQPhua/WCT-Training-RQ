import { beforeEach, describe, expect, it } from "vitest";
import { seed } from "@/db/seed";
import { createDraft, performAction, setNotifier } from "@/lib/services/requests";
import { getDashboard } from "@/lib/services/dashboard";
import { asUser, validDraft } from "./helpers";
import { resetDb } from "./setup";

beforeEach(async () => {
  await resetDb();
  await seed({ demo: true });
  setNotifier(async () => {});
});

async function submitAs(email: string) {
  const u = await asUser(email);
  const { id } = await createDraft(u, validDraft);
  await performAction(u, { requestId: id, version: 1, type: "SUBMIT" });
  return id;
}

describe("getDashboard", () => {
  it("counts requests awaiting the HOD", async () => {
    await submitAs("requester@demo.wct.my");
    await submitAs("requester@demo.wct.my");
    const d = await getDashboard(await asUser("hod.land@demo.wct.my"));
    expect(d.awaitingMe).toBe(2);
    expect(d.awaitingList).toHaveLength(2);
  });

  it("requester sees own open requests and the board shows only visible requests", async () => {
    await submitAs("requester@demo.wct.my");
    await submitAs("requester.malls@demo.wct.my");
    const d = await getDashboard(await asUser("requester@demo.wct.my"));
    expect(d.myOpen).toBe(1);
    expect(d.board).toHaveLength(1);
    expect(d.board[0].status).toBe("PENDING_HOD");
  });

  it("sums approved fees for the year in the user's scope", async () => {
    const id = await submitAs("requester@demo.wct.my");
    for (const [email, v] of [["hod.land@demo.wct.my", 2], ["buadmin.land@demo.wct.my", 3], ["lnd1@demo.wct.my", 4], ["hrhead@demo.wct.my", 5]] as const) {
      await performAction(await asUser(email), { requestId: id, version: v, type: "APPROVE" });
    }
    const d = await getDashboard(await asUser("hrhead@demo.wct.my"));
    expect(d.upcoming.map((u) => u.id)).toEqual([id]);
    expect(d.upcoming[0].candidateCount).toBe(2);
    expect(d.approvedThisYear).toBe(1);
    expect(d.feesThisYear).toBe("2501.00"); // 1250.50 × 2 candidates
  });
});
