import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { loadCurrentUser, type CurrentUser } from "@/lib/auth/load-user";
import type { DraftInput } from "@/lib/validation/request";

export async function asUser(email: string): Promise<CurrentUser> {
  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (!u) throw new Error(`No seeded user ${email}`);
  const cu = await loadCurrentUser(u.id);
  if (!cu) throw new Error(`Could not load ${email}`);
  return cu;
}

export const validDraft: DraftInput = {
  trainingType: "PLANNED",
  title: "Advanced Excel for Engineers",
  objective: "Improve reporting productivity",
  relevancy: "Engineers prepare monthly progress reports in Excel.",
  startDate: "2026-11-02",
  endDate: "2026-11-03",
  startTime: "09:00",
  endTime: "17:00",
  feePerPax: "1250.50",
  venue: "WCT Tower, Level 5",
  conductedBy: "ABC Training Sdn Bhd",
  candidates: [
    { name: "Aisyah Rahman", email: "requester@demo.wct.my" },
    { name: "Ahmad Faiz" },
  ],
};
