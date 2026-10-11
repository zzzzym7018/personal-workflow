import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("active"),
  progress: integer("progress").notNull().default(0),
  color: text("color").notNull().default("#3449A4"),
  deadline: text("deadline"),
  nextAction: text("next_action").notNull().default(""),
  archivedAt: text("archived_at"),
  ...timestamps,
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  domainId: text("domain_id"),
  title: text("title").notNull(),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("normal"),
  dueDate: text("due_date"),
  startAt: text("start_at"),
  endAt: text("end_at"),
  archivedAt: text("archived_at"),
  ...timestamps,
});

export const domains = sqliteTable("domains", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  stage: integer("stage").notNull().default(1),
  summary: text("summary").notNull().default(""),
  nextStep: text("next_step").notNull().default(""),
  color: text("color").notNull().default("#167F78"),
  archivedAt: text("archived_at"),
  ...timestamps,
});

export const learningLogs = sqliteTable("learning_logs", {
  id: text("id").primaryKey(),
  domainId: text("domain_id").notNull(),
  title: text("title").notNull(),
  note: text("note").notNull().default(""),
  minutes: integer("minutes").notNull().default(0),
  occurredAt: text("occurred_at").notNull(),
  ...timestamps,
});

export const knowledgeNotes = sqliteTable("knowledge_notes", {
  id: text("id").primaryKey(),
  domainId: text("domain_id"),
  kind: text("kind").notNull().default("note"),
  stage: integer("stage"),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  archivedAt: text("archived_at"),
  ...timestamps,
});

export const ideas = sqliteTable("ideas", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  note: text("note").notNull().default(""),
  type: text("type").notNull().default("idea"),
  status: text("status").notNull().default("inbox"),
  projectId: text("project_id"),
  domainId: text("domain_id"),
  archivedAt: text("archived_at"),
  ...timestamps,
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  startAt: text("start_at").notNull(),
  endAt: text("end_at").notNull(),
  allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
  notes: text("notes").notNull().default(""),
  color: text("color").notNull().default("#159AA9"),
  source: text("source").notNull().default("local"),
  externalId: text("external_id"),
  externalCalendarId: text("external_calendar_id"),
  syncStatus: text("sync_status").notNull().default("local"),
  projectId: text("project_id"),
  archivedAt: text("archived_at"),
  ...timestamps,
});

export const googleConnections = sqliteTable("google_connections", {
  userEmail: text("user_email").primaryKey(),
  googleEmail: text("google_email").notNull(),
  accessTokenCipher: text("access_token_cipher").notNull(),
  refreshTokenCipher: text("refresh_token_cipher"),
  expiresAt: integer("expires_at").notNull(),
  scope: text("scope").notNull().default(""),
  lastSyncAt: text("last_sync_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const googleCalendars = sqliteTable("google_calendars", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  calendarId: text("calendar_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#159AA9"),
  selected: integer("selected", { mode: "boolean" }).notNull().default(false),
  writable: integer("writable", { mode: "boolean" }).notNull().default(false),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
});
