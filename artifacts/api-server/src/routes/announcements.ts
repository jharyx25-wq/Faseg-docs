import {
  and,
  asc,
  desc,
  eq,
  ilike,
  or,
} from "drizzle-orm";
import {
  CreateAnnouncementBody,
  CreateAnnouncementResponse,
  DeleteAnnouncementParams,
  ListAnnouncementsQueryParams,
  ListAnnouncementsResponse,
  UpdateAnnouncementBody,
  UpdateAnnouncementParams,
  UpdateAnnouncementResponse,
} from "@workspace/api-zod";
import { announcementsTable, db } from "@workspace/db";
import { Router, type IRouter } from "express";
import { requireTeacher } from "../lib/teacherAuth";

const router: IRouter = Router();

function publicAnnouncement(row: typeof announcementsTable.$inferSelect) {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

router.get("/announcements", async (req, res): Promise<void> => {
  const parsed = ListAnnouncementsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filtres d'annonces invalides." });
    return;
  }

  const { category, search } = parsed.data;
  const conditions = [];
  if (category) {
    conditions.push(eq(announcementsTable.category, category));
  }
  if (search?.trim()) {
    const pattern = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(announcementsTable.title, pattern),
        ilike(announcementsTable.content, pattern),
        ilike(announcementsTable.subject, pattern),
      ),
    );
  }

  const rows = await db
    .select()
    .from(announcementsTable)
    .where(and(...conditions))
    .orderBy(asc(announcementsTable.eventDate), desc(announcementsTable.createdAt));

  res.json(ListAnnouncementsResponse.parse(rows.map(publicAnnouncement)));
});

router.post(
  "/announcements",
  requireTeacher,
  async (req, res): Promise<void> => {
    const parsed = CreateAnnouncementBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Les informations de l'annonce sont invalides." });
      return;
    }
    const input = parsed.data;

    const [row] = await db
      .insert(announcementsTable)
      .values({
        title: input.title.trim(),
        content: input.content.trim(),
        category: input.category,
        subject: input.subject?.trim() || null,
        level: input.level?.trim() || null,
        eventDate: input.eventDate ?? null,
        startTime: input.startTime?.trim() || null,
        endTime: input.endTime?.trim() || null,
        location: input.location?.trim() || null,
      })
      .returning();
    if (!row) {
      res.status(500).json({ error: "L'annonce n'a pas pu être publiée." });
      return;
    }

    res.status(201).json(CreateAnnouncementResponse.parse(publicAnnouncement(row)));
  },
);

router.patch(
  "/announcements/:id",
  requireTeacher,
  async (req, res): Promise<void> => {
    const params = UpdateAnnouncementParams.safeParse(req.params);
    const parsed = UpdateAnnouncementBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Les informations de l'annonce sont invalides." });
      return;
    }
    const input = parsed.data;
    const updates = {
      ...(input.title !== undefined && { title: input.title.trim() }),
      ...(input.content !== undefined && { content: input.content.trim() }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.subject !== undefined && {
        subject: input.subject?.trim() || null,
      }),
      ...(input.level !== undefined && { level: input.level?.trim() || null }),
      ...(input.eventDate !== undefined && { eventDate: input.eventDate }),
      ...(input.startTime !== undefined && {
        startTime: input.startTime?.trim() || null,
      }),
      ...(input.endTime !== undefined && {
        endTime: input.endTime?.trim() || null,
      }),
      ...(input.location !== undefined && {
        location: input.location?.trim() || null,
      }),
    };
    const [row] = await db
      .update(announcementsTable)
      .set(updates)
      .where(eq(announcementsTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Annonce introuvable." });
      return;
    }

    res.json(UpdateAnnouncementResponse.parse(publicAnnouncement(row)));
  },
);

router.delete(
  "/announcements/:id",
  requireTeacher,
  async (req, res): Promise<void> => {
    const params = DeleteAnnouncementParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Identifiant d'annonce invalide." });
      return;
    }
    const [row] = await db
      .delete(announcementsTable)
      .where(eq(announcementsTable.id, params.data.id))
      .returning({ id: announcementsTable.id });
    if (!row) {
      res.status(404).json({ error: "Annonce introuvable." });
      return;
    }
    res.status(204).end();
  },
);

export default router;
