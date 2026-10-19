import { and, count, gte, isNotNull } from "drizzle-orm";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { announcementsTable, db, documentsTable } from "@workspace/db";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

function beninCalendarDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Porto-Novo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [documents] = await db.select({ value: count() }).from(documentsTable);
  const [announcements] = await db
    .select({ value: count() })
    .from(announcementsTable);
  const [upcoming] = await db
    .select({ value: count() })
    .from(announcementsTable)
    .where(
      and(
        isNotNull(announcementsTable.eventDate),
        gte(announcementsTable.eventDate, beninCalendarDate()),
      ),
    );

  res.json(
    GetDashboardSummaryResponse.parse({
      documentCount: documents?.value ?? 0,
      announcementCount: announcements?.value ?? 0,
      upcomingCount: upcoming?.value ?? 0,
    }),
  );
});

export default router;
