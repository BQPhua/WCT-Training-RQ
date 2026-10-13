import { sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { formatRefNo } from "@/lib/format";

/** Atomically allocates the next TRQ-YYYY-NNNN for a year. */
export async function allocateRefNo(tx: Tx, year: number): Promise<string> {
  const res = await tx.execute<{ last_no: number }>(sql`
    INSERT INTO ref_counters (year, last_no) VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE SET last_no = ref_counters.last_no + 1
    RETURNING last_no
  `);
  return formatRefNo(year, Number(res.rows[0].last_no));
}
