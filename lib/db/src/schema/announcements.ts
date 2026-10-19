import { createInsertSchema } from "drizzle-zod";
import {
  date,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const announcementCategory = pgEnum("faseg_announcement_category", [
  "announcement",
  "homework",
  "exam",
  "schedule",
  "schedule_change",
]);

export const announcementsTable = pgTable("faseg_announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: announcementCategory("category").notNull(),
  subject: text("subject"),
  level: text("level"),
  eventDate: date("event_date", { mode: "string" }),
  startTime: text("start_time"),
  endTime: text("end_time"),
  location: text("location"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAnnouncementSchema = createInsertSchema(
  announcementsTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertAnnouncement = typeof announcementsTable.$inferInsert;
export type Announcement = typeof announcementsTable.$inferSelect;
