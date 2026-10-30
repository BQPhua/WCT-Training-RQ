export interface DirectoryPerson {
  id: string;
  name: string;
  email: string;
  jobTitle?: string;
  department?: string;
}
export interface DirectoryResult {
  people: DirectoryPerson[];
  source: "graph" | "local";
}
import { getGraphToken, type GraphConfig } from "./graph";
type GraphUser = { id: string; displayName?: string; mail?: string | null; jobTitle?: string | null; department?: string | null };

/**
 * People search for the candidate picker. Uses Microsoft Graph with an
 * app-only token (User.Read.All, admin-consented); falls back to the local
 * users table whenever Graph is unavailable or not configured.
 */
export function createDirectory(opts: {
  config: GraphConfig | null;
  localSearch: (q: string) => Promise<DirectoryPerson[]>;
}) {
  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(cfg: GraphConfig): Promise<string> {
    if (token && token.expiresAt - 60_000 > Date.now()) return token.value;
    token = await getGraphToken(cfg);
    return token.value;
  }

  async function graphSearch(cfg: GraphConfig, q: string): Promise<DirectoryPerson[]> {
    const t = await getToken(cfg);
    const params = new URLSearchParams({
      $search: `"displayName:${q}" OR "mail:${q}"`,
      $select: "id,displayName,mail,jobTitle,department",
      $filter: "accountEnabled eq true",
      $count: "true",
      $top: "10",
    });
    const res = await fetch(`https://graph.microsoft.com/v1.0/users?${params}`, {
      headers: { Authorization: `Bearer ${t}`, ConsistencyLevel: "eventual" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Graph users HTTP ${res.status}`);
    const json = (await res.json()) as { value: GraphUser[] };
    return json.value
      .filter((u) => !!u.mail)
      .map((u) => ({
        id: u.id,
        name: u.displayName ?? u.mail!,
        email: u.mail!.toLowerCase(),
        ...(u.jobTitle ? { jobTitle: u.jobTitle } : {}),
        ...(u.department ? { department: u.department } : {}),
      }));
  }

  return {
    async search(raw: string): Promise<DirectoryResult> {
      const q = raw.replace(/["\\]/g, "").trim().slice(0, 60);
      if (q.length < 2) return { people: [], source: "graph" };
      if (opts.config) {
        try {
          return { people: await graphSearch(opts.config, q), source: "graph" };
        } catch (e) {
          console.warn("[directory] Graph search failed, using local users:", e instanceof Error ? e.message : e);
        }
      }
      return { people: await opts.localSearch(q), source: "local" };
    },
  };
}
