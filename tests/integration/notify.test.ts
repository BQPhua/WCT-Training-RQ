import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationLogs } from "@/db/schema";
import { seed } from "@/db/seed";
import { createDraft, performAction, setNotifier } from "@/lib/services/requests";
import { notifyEvent, retryFailed } from "@/lib/notify/send";
import { POST as cronPost } from "@/app/api/cron/notifications/route";
import { asUser, validDraft } from "./helpers";
import { resetDb } from "./setup";

const fetchMock = vi.fn();

beforeEach(async () => {
  await resetDb();
  await seed({ demo: true });
  vi.stubEnv("POWER_AUTOMATE_FLOW_URL", "https://prod.example/flow");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  setNotifier(notifyEvent);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function submit() {
  const req = await asUser("requester@demo.wct.my");
  const { id } = await createDraft(req, validDraft);
  await performAction(req, { requestId: id, version: 1, type: "SUBMIT" });
  return id;
}

describe("notifyEvent", () => {
  it("posts the payload to the flow and logs SENT", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 202 }));
    await submit();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://prod.example/flow");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["hod.land@demo.wct.my"]);
    expect(body.event).toBe("SUBMITTED");
    const [log] = await db.select().from(notificationLogs);
    expect(log.status).toBe("SENT");
  });

  it("logs FAILED with the error, then a retry succeeds", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    await submit();
    let [log] = await db.select().from(notificationLogs);
    expect(log.status).toBe("FAILED");
    expect(log.attempts).toBe(1);
    expect(log.lastError).toMatch(/500/);

    await db.update(notificationLogs).set({ updatedAt: new Date(Date.now() - 6 * 60_000) }).where(eq(notificationLogs.id, log.id));
    fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
    expect(await retryFailed()).toBe(1);
    [log] = await db.select().from(notificationLogs);
    expect(log.status).toBe("SENT");
    expect(log.attempts).toBe(2);
  });

  it("does not retry after 3 attempts", async () => {
    fetchMock.mockResolvedValue(new Response("x", { status: 500 }));
    await submit();
    await db.update(notificationLogs).set({ attempts: 3, updatedAt: new Date(Date.now() - 6 * 60_000) });
    expect(await retryFailed()).toBe(0);
  });

  it("marks FAILED when the flow URL is not configured", async () => {
    vi.stubEnv("POWER_AUTOMATE_FLOW_URL", "");
    await submit();
    const [log] = await db.select().from(notificationLogs);
    expect(log.status).toBe("FAILED");
    expect(log.lastError).toMatch(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a network error never breaks the workflow action", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const id = await submit();
    expect(id).toBeTruthy();
    const [log] = await db.select().from(notificationLogs);
    expect(log.lastError).toMatch(/ECONNRESET/);
  });
});

describe("cron route", () => {
  it("rejects requests without the bearer secret", async () => {
    const res = await cronPost(new Request("http://x/api/cron/notifications", { method: "POST" }) as never);
    expect(res.status).toBe(401);
  });

  it("accepts the correct secret", async () => {
    const res = await cronPost(
      new Request("http://x/api/cron/notifications", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }) as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ retried: 0 });
  });
});
