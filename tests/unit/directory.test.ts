import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDirectory } from "@/lib/services/directory";

const fetchMock = vi.fn();
const local = vi.fn(async (q: string) => [{ id: "l1", name: `Local ${q}`, email: "local@wct.my" }]);
const config = { tenantId: "t", clientId: "c", clientSecret: "s" };

function tokenResponse() {
  return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
}
function usersResponse() {
  return new Response(
    JSON.stringify({ value: [{ id: "g1", displayName: "Aisyah Rahman", mail: "Aisyah@wct.my", jobTitle: "Engineer", department: "Land" }, { id: "g2", displayName: "No Mail" }] }),
    { status: 200 },
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  local.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("directory search", () => {
  it("returns [] for queries shorter than 2 characters without calling anything", async () => {
    const dir = createDirectory({ config, localSearch: local });
    expect(await dir.search("a")).toEqual({ people: [], source: "graph" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the app token once across searches and maps users with mail only", async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).includes("/token") ? tokenResponse() : usersResponse()));
    const dir = createDirectory({ config, localSearch: local });
    const r1 = await dir.search("ais");
    await dir.search("rah");
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes("/token"))).toHaveLength(1);
    expect(r1).toEqual({
      source: "graph",
      people: [{ id: "g1", name: "Aisyah Rahman", email: "aisyah@wct.my", jobTitle: "Engineer", department: "Land" }],
    });
  });

  it("falls back to local users when Graph errors", async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).includes("/token") ? tokenResponse() : new Response("", { status: 503 })));
    const dir = createDirectory({ config, localSearch: local });
    const r = await dir.search("ali");
    expect(r.source).toBe("local");
    expect(r.people[0].name).toBe("Local ali");
  });

  it("uses local search when Graph is not configured", async () => {
    const dir = createDirectory({ config: null, localSearch: local });
    expect((await dir.search("ali")).source).toBe("local");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("strips quotes from the query to keep the $search expression valid", async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).includes("/token") ? tokenResponse() : usersResponse()));
    const dir = createDirectory({ config, localSearch: local });
    await dir.search('ai"sy');
    const usersUrl = decodeURIComponent(String(fetchMock.mock.calls.find(([u]) => String(u).includes("/users"))![0]));
    expect(usersUrl).toContain('"displayName:aisy"');
  });
});
