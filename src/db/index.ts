import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
/** A transaction handle or the root db — services accept either. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0] | DB;

const globalForDb = globalThis as unknown as { __trqPool?: Pool; __trqDb?: DB };

function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing required environment variable DATABASE_URL");
  const pool = new Pool({ connectionString: url, max: 10 });
  globalForDb.__trqPool = pool;
  return drizzle(pool, { schema });
}

/** Lazily-initialised singleton so `next build` doesn't need a DB. */
export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    globalForDb.__trqDb ??= createDb();
    const value = Reflect.get(globalForDb.__trqDb, prop);
    return typeof value === "function" ? value.bind(globalForDb.__trqDb) : value;
  },
});

export async function closeDb() {
  await globalForDb.__trqPool?.end();
  globalForDb.__trqPool = undefined;
  globalForDb.__trqDb = undefined;
}

export { schema };
