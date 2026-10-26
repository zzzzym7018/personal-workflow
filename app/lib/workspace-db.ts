import { env } from "cloudflare:workers";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import {
  domains,
  events,
  googleCalendars,
  googleConnections,
  ideas,
  knowledgeNotes,
  learningLogs,
  projects,
  tasks,
} from "../../db/schema";

type RuntimeEnv = { DB: D1Database };

let ready: Promise<void> | null = null;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active',
    progress INTEGER NOT NULL DEFAULT 0, color TEXT NOT NULL DEFAULT '#3449A4', deadline TEXT, next_action TEXT NOT NULL DEFAULT '',
    archived_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, project_id TEXT, domain_id TEXT, title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo', priority TEXT NOT NULL DEFAULT 'normal', planned_date TEXT, due_date TEXT, start_at TEXT, end_at TEXT,
    archived_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, stage INTEGER NOT NULL DEFAULT 1, summary TEXT NOT NULL DEFAULT '',
    next_step TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '#167F78', archived_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS learning_logs (
    id TEXT PRIMARY KEY, domain_id TEXT NOT NULL, title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', minutes INTEGER NOT NULL DEFAULT 0,
    occurred_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_notes (
    id TEXT PRIMARY KEY, domain_id TEXT, kind TEXT NOT NULL DEFAULT 'note', stage INTEGER,
    title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', archived_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'idea',
    status TEXT NOT NULL DEFAULT 'inbox', project_id TEXT, domain_id TEXT, archived_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, start_at TEXT NOT NULL, end_at TEXT NOT NULL, all_day INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '#159AA9', source TEXT NOT NULL DEFAULT 'local', external_id TEXT,
    external_calendar_id TEXT, sync_status TEXT NOT NULL DEFAULT 'local', project_id TEXT, archived_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS google_connections (
    user_email TEXT PRIMARY KEY, google_email TEXT NOT NULL, access_token_cipher TEXT NOT NULL, refresh_token_cipher TEXT,
    expires_at INTEGER NOT NULL, scope TEXT NOT NULL DEFAULT '', last_sync_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS google_calendars (
    id TEXT PRIMARY KEY, user_email TEXT NOT NULL, calendar_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#159AA9',
    selected INTEGER NOT NULL DEFAULT 0, writable INTEGER NOT NULL DEFAULT 0, is_primary INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS events_external_idx ON events(external_calendar_id, external_id)",
  "CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id, status)",
  "CREATE INDEX IF NOT EXISTS ideas_domain_idx ON ideas(domain_id, status)",
  "CREATE INDEX IF NOT EXISTS knowledge_notes_domain_idx ON knowledge_notes(domain_id, kind, updated_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_owner_idx ON google_calendars(user_email, calendar_id)",
];

export async function ensureWorkspaceSchema() {
  if (!ready) {
    const runtimeEnv = env as unknown as RuntimeEnv;
    ready = (async () => {
      await runtimeEnv.DB.batch(
        schemaStatements.map((sql) => runtimeEnv.DB.prepare(sql)),
      );
      const taskColumns = await runtimeEnv.DB.prepare(
        "PRAGMA table_info(tasks)",
      ).all<{ name: string }>();
      if (!taskColumns.results.some((column) => column.name === "planned_date")) {
        await runtimeEnv.DB.prepare(
          "ALTER TABLE tasks ADD COLUMN planned_date TEXT",
        ).run();
        await runtimeEnv.DB.prepare(
          `UPDATE tasks
           SET planned_date = substr(datetime(created_at, '+8 hours'), 1, 10)
           WHERE planned_date IS NULL AND project_id IS NULL`,
        ).run();
      }
    })();
  }
  await ready;
}

export async function seedWorkspace() {
  await ensureWorkspaceSchema();
  const db = getDb();
  const existing = await db.select({ id: projects.id }).from(projects).limit(1);
  if (existing.length) return;

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  await db.batch([
    db.insert(projects).values({
      id: "project-personal-web",
      title: "个人助手网站",
      description: "把日程、项目和领域学习连接到一个安静的个人工作台。",
      progress: 68,
      color: "#3449A4",
      deadline: addDays(today, 21),
      nextAction: "完成交互原型并连接持久化数据",
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(projects).values({
      id: "project-rl",
      title: "强化学习实验",
      description: "复现实验基线并明确离线策略评估指标。",
      progress: 42,
      color: "#D48B2C",
      deadline: addDays(today, 35),
      nextAction: "明确离线策略评估指标",
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(tasks).values({
      id: "task-experiment-draft",
      projectId: "project-rl",
      title: "完成实验方案初稿",
      notes: "补齐数据、指标和对照组。",
      status: "doing",
      priority: "high",
      dueDate: today,
      startAt: withLocalTime(today, "10:00"),
      endAt: withLocalTime(today, "11:30"),
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(tasks).values({
      id: "task-info-architecture",
      projectId: "project-personal-web",
      title: "确定网站信息架构",
      status: "done",
      priority: "normal",
      dueDate: today,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(domains).values({
      id: "domain-causal",
      title: "因果推断",
      stage: 2,
      summary: "正在建立识别假设与反事实框架之间的整体地图。",
      nextStep: "整理混杂、选择偏差和可识别性的边界",
      color: "#167F78",
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(domains).values({
      id: "domain-rl",
      title: "强化学习",
      stage: 3,
      summary: "能够解释主要范式，正在深入离线数据分布偏移问题。",
      nextStep: "连接 OPE 方法与当前实验设计",
      color: "#D48B2C",
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(ideas).values({
      id: "idea-offline-bias",
      title: "离线数据偏差如何影响策略评估？",
      note: "比较重要性采样、模型方法和双稳健估计在覆盖不足时的误差。",
      type: "question",
      status: "exploring",
      projectId: "project-rl",
      domainId: "domain-rl",
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(events).values({
      id: "event-focus",
      title: "完成实验方案初稿",
      startAt: withLocalTime(today, "10:00"),
      endAt: withLocalTime(today, "11:30"),
      color: "#3449A4",
      source: "local",
      syncStatus: "pending",
      projectId: "project-rl",
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(events).values({
      id: "event-meeting",
      title: "组会",
      startAt: withLocalTime(today, "12:20"),
      endAt: withLocalTime(today, "13:10"),
      color: "#159AA9",
      source: "local",
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    }),
  ]);
}

async function readWorkspaceSnapshot(learningLogLimit?: number) {
  await seedWorkspace();
  const db = getDb();
  const learningLogQuery = db.select().from(learningLogs).orderBy(desc(learningLogs.occurredAt));
  const learningLogRows = learningLogLimit === undefined
    ? learningLogQuery
    : learningLogQuery.limit(learningLogLimit);
  const [projectRows, taskRows, domainRows, logRows, knowledgeNoteRows, ideaRows, eventRows] = await Promise.all([
    db.select().from(projects).where(isNull(projects.archivedAt)).orderBy(asc(projects.createdAt)),
    db.select().from(tasks).where(isNull(tasks.archivedAt)).orderBy(asc(tasks.createdAt)),
    db.select().from(domains).where(isNull(domains.archivedAt)).orderBy(asc(domains.createdAt)),
    learningLogRows,
    db.select().from(knowledgeNotes).where(isNull(knowledgeNotes.archivedAt)).orderBy(desc(knowledgeNotes.updatedAt)),
    db.select().from(ideas).where(isNull(ideas.archivedAt)).orderBy(desc(ideas.createdAt)),
    db.select().from(events).where(isNull(events.archivedAt)).orderBy(asc(events.startAt)),
  ]);
  return { projects: projectRows, tasks: taskRows, domains: domainRows, learningLogs: logRows, knowledgeNotes: knowledgeNoteRows, ideas: ideaRows, events: eventRows };
}

export async function getWorkspaceSnapshot() {
  return readWorkspaceSnapshot(50);
}

export async function getWorkspaceExportSnapshot() {
  return readWorkspaceSnapshot();
}

export async function getGoogleConnection(email: string) {
  await ensureWorkspaceSchema();
  const rows = await getDb().select().from(googleConnections).where(eq(googleConnections.userEmail, email)).limit(1);
  return rows[0] ?? null;
}

export async function getSelectedGoogleCalendars(email: string) {
  await ensureWorkspaceSchema();
  return getDb().select().from(googleCalendars).where(and(eq(googleCalendars.userEmail, email), eq(googleCalendars.selected, true)));
}

export async function getAllGoogleCalendars(email: string) {
  await ensureWorkspaceSchema();
  return getDb().select().from(googleCalendars).where(eq(googleCalendars.userEmail, email)).orderBy(desc(googleCalendars.isPrimary), asc(googleCalendars.name));
}

export function nowIso() {
  return new Date().toISOString();
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T00:00:00+08:00`);
  value.setDate(value.getDate() + amount);
  return value.toISOString().slice(0, 10);
}

function withLocalTime(date: string, time: string) {
  return new Date(`${date}T${time}:00+08:00`).toISOString();
}
