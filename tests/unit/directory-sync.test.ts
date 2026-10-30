import { describe, expect, it, vi } from "vitest";
import { fetchDirectoryPeople } from "@/lib/services/directory-sync";

const cfg = { tenantId: "t1", clientId: "c1", clientSecret: "s1" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function graph(pages: unknown[][]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.includes("/oauth2/v2.0/token")) return json({ access_token: "tok", expires_in: 3600 });
    const i = u.includes("skiptoken=") ? Number(new URL(u).searchParams.get("skiptoken")) : 0;
    return json({ value: pages[i], ...(i + 1 < pages.length ? { "@odata.nextLink": `https://graph.microsoft.com/v1.0/users?skiptoken=${i + 1}` } : {}) });
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls };
}

const person = (id: string, over: Record<string, unknown> = {}) => ({
  id, displayName: `Person ${id}`, mail: `p${id}@wct.my`, userPrincipalName: `p${id}@wct.onmicrosoft.com`,
  jobTitle: "Engineer", department: "E&C – Engineering", accountEnabled: true, userType: "Member", ...over,
});

describe("fetchDirectoryPeople", () => {
  it("joins every page", async () => {
    const { fetchFn } = graph([[person("1"), person("2")], [person("3")]]);
    const people = await fetchDirectoryPeople(cfg, fetchFn);
    expect(people.map((p) => p.oid)).toEqual(["1", "2", "3"]);
  });

  it("asks only for enabled members, with the advanced-query header", async () => {
    const { fetchFn, calls } = graph([[person("1")]]);
    await fetchDirectoryPeople(cfg, fetchFn);
    const usersCall = calls.find((c) => c.url.includes("/v1.0/users"))!;
    const url = new URL(usersCall.url);
    expect(url.searchParams.get("$filter")).toBe("accountEnabled eq true and userType eq 'Member'");
    expect(url.searchParams.get("$top")).toBe("999");
    expect(url.searchParams.get("$count")).toBe("true");
    expect(new Headers(usersCall.init?.headers).get("ConsistencyLevel")).toBe("eventual");
    expect(new Headers(usersCall.init?.headers).get("Authorization")).toBe("Bearer tok");
  });

  it("skips guests and disabled accounts even if Graph returns them", async () => {
    const { fetchFn } = graph([[person("1"), person("2", { userType: "Guest" }), person("3", { accountEnabled: false })]]);
    expect((await fetchDirectoryPeople(cfg, fetchFn)).map((p) => p.oid)).toEqual(["1"]);
  });

  it("uses the UPN when there is no mail, lower-cased; skips people with neither", async () => {
    const { fetchFn } = graph([[person("1", { mail: null, userPrincipalName: "Amir.Hakim@WCT.my" }), person("2", { mail: null, userPrincipalName: null })]]);
    const people = await fetchDirectoryPeople(cfg, fetchFn);
    expect(people).toEqual([{ oid: "1", email: "amir.hakim@wct.my", name: "Person 1", jobTitle: "Engineer", department: "E&C – Engineering" }]);
  });

  it("fails loudly when Graph refuses", async () => {
    const fetchFn = vi.fn(async (url: string | URL) =>
      String(url).includes("token") ? json({ access_token: "tok", expires_in: 3600 }) : json({ error: { message: "Insufficient privileges" } }, 403),
    ) as unknown as typeof fetch;
    await expect(fetchDirectoryPeople(cfg, fetchFn)).rejects.toThrow(/HTTP 403/);
  });
});
