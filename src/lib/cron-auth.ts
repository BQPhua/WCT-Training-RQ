import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Server crontab calls carry `Authorization: Bearer $CRON_SECRET` (compared in constant time). */
export function cronAuthorised(header: string | null): boolean {
  const secret = env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
