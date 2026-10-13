import "server-only";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { departments, users } from "@/db/schema";
import { env } from "@/lib/env";
import { createDirectory, type DirectoryPerson } from "./directory";

async function localSearch(q: string): Promise<DirectoryPerson[]> {
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, jobTitle: users.jobTitle, department: departments.name })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.isActive, true), or(ilike(users.name, like), ilike(users.email, like))))
    .limit(10);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    ...(r.jobTitle ? { jobTitle: r.jobTitle } : {}),
    ...(r.department ? { department: r.department } : {}),
  }));
}

export const directory = createDirectory({
  config:
    env.ENTRA_TENANT_ID && env.ENTRA_CLIENT_ID && env.ENTRA_CLIENT_SECRET
      ? { tenantId: env.ENTRA_TENANT_ID, clientId: env.ENTRA_CLIENT_ID, clientSecret: env.ENTRA_CLIENT_SECRET }
      : null,
  localSearch,
});
