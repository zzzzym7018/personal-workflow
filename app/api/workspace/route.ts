import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { domains, events, ideas, knowledgeNotes, learningLogs, projects, tasks } from "../../../db/schema";
import { deleteGoogleCalendarEvent } from "../../lib/google-calendar";
import { accessErrorResponse, requireAllowedViewer } from "../../lib/server-auth";
import { getWorkspaceSnapshot, nowIso, seedWorkspace } from "../../lib/workspace-db";

type EntityName = "project" | "task" | "domain" | "idea" | "event" | "learningLog" | "knowledgeNote";
type JsonRecord = Record<string, unknown>;

class InputError extends Error {}

export async function GET() {
  try {
    const viewer = await requireAllowedViewer();
    const snapshot = await getWorkspaceSnapshot();
    return Response.json({ ...snapshot, viewer: { displayName: viewer.displayName, email: viewer.email, isPreview: viewer.isPreview } });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAllowedViewer();
    await seedWorkspace();
    const body = (await request.json()) as { entity?: EntityName; data?: JsonRecord };
    if (!body.entity || !body.data) return Response.json({ error: "缺少创建内容。" }, { status: 400 });
    const item = await createEntity(body.entity, body.data);
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAllowedViewer();
    await seedWorkspace();
    const body = (await request.json()) as { entity?: EntityName; id?: string; data?: JsonRecord };
    if (!body.entity || !body.id || !body.data) return Response.json({ error: "缺少更新内容。" }, { status: 400 });
    const item = await updateEntity(body.entity, body.id, body.data);
    return Response.json({ item });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const viewer = await requireAllowedViewer();
    await seedWorkspace();
    const body = (await request.json()) as {
      entity?: Exclude<EntityName, "learningLog" | "knowledgeNote">;
      id?: string;
      action?: "archive" | "delete";
    };
    if (!body.entity || !body.id) return Response.json({ error: "缺少操作对象。" }, { status: 400 });
    if (body.action === "delete") {
      const db = getDb();
      const updatedAt = nowIso();
      switch (body.entity) {
        case "project":
          await db.batch([
            db.delete(tasks).where(eq(tasks.projectId, body.id)),
            db.update(ideas).set({ projectId: null, updatedAt }).where(eq(ideas.projectId, body.id)),
            db.update(events).set({ projectId: null, updatedAt }).where(eq(events.projectId, body.id)),
            db.delete(projects).where(eq(projects.id, body.id)),
          ]);
          break;
        case "task":
          await db.delete(tasks).where(eq(tasks.id, body.id));
          break;
        case "event": {
          const existing = await db.select().from(events).where(eq(events.id, body.id)).limit(1);
          const item = existing[0];
          if (!item) throw new InputError("这个日程已经不存在。 ");
          if (!viewer.isPreview && item.externalCalendarId && item.externalId) {
            try {
              await deleteGoogleCalendarEvent(viewer.email, item.externalCalendarId, item.externalId);
            } catch {
              throw new InputError("未能从 Google Calendar 删除该日程，请检查日历权限后重试。 ");
            }
          }
          await db.delete(events).where(eq(events.id, body.id));
          break;
        }
        case "domain":
          await db.batch([
            db.delete(knowledgeNotes).where(eq(knowledgeNotes.domainId, body.id)),
            db.delete(learningLogs).where(eq(learningLogs.domainId, body.id)),
            db.update(tasks).set({ domainId: null, updatedAt }).where(eq(tasks.domainId, body.id)),
            db.update(ideas).set({ domainId: null, updatedAt }).where(eq(ideas.domainId, body.id)),
            db.delete(domains).where(eq(domains.id, body.id)),
          ]);
          break;
        case "idea":
          await db.delete(ideas).where(eq(ideas.id, body.id));
          break;
      }
      return Response.json({ deleted: true });
    }
    const archivedAt = nowIso();
    const db = getDb();
    switch (body.entity) {
      case "project": await db.update(projects).set({ archivedAt, updatedAt: archivedAt }).where(eq(projects.id, body.id)); break;
      case "task": await db.update(tasks).set({ archivedAt, updatedAt: archivedAt }).where(eq(tasks.id, body.id)); break;
      case "domain": await db.update(domains).set({ archivedAt, updatedAt: archivedAt }).where(eq(domains.id, body.id)); break;
      case "idea": await db.update(ideas).set({ archivedAt, updatedAt: archivedAt }).where(eq(ideas.id, body.id)); break;
      case "event": await db.update(events).set({ archivedAt, updatedAt: archivedAt, syncStatus: "archive-pending" }).where(eq(events.id, body.id)); break;
    }
    return Response.json({ archived: true });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

async function createEntity(entity: EntityName, data: JsonRecord) {
  const db = getDb();
  const now = nowIso();
  const id = crypto.randomUUID();
  const title = requiredText(data.title, "请填写标题。 ");
  switch (entity) {
    case "project": {
      const row = { id, title, description: optionalText(data.description), status: "active", progress: 0, color: optionalText(data.color) || "#3449A4", deadline: nullableText(data.deadline), nextAction: "", archivedAt: null, createdAt: now, updatedAt: now };
      await db.insert(projects).values(row); return row;
    }
    case "task": {
      const row = { id, title, notes: optionalText(data.notes ?? data.note), status: optionalText(data.status) || "todo", priority: optionalText(data.priority) || "normal", projectId: nullableText(data.projectId), domainId: nullableText(data.domainId), plannedDate: nullableText(data.plannedDate), dueDate: nullableText(data.dueDate), startAt: nullableText(data.startAt), endAt: nullableText(data.endAt), archivedAt: null, createdAt: now, updatedAt: now };
      await db.insert(tasks).values(row); return row;
    }
    case "domain": {
      const row = { id, title, stage: clampNumber(data.stage, 1, 5, 1), summary: optionalText(data.summary), nextStep: optionalText(data.nextStep), color: optionalText(data.color) || "#167F78", archivedAt: null, createdAt: now, updatedAt: now };
      await db.insert(domains).values(row); return row;
    }
    case "idea": {
      const row = { id, title, note: optionalText(data.note), type: optionalText(data.type) === "question" ? "question" : "idea", status: optionalText(data.status) || "inbox", projectId: nullableText(data.projectId), domainId: nullableText(data.domainId), archivedAt: null, createdAt: now, updatedAt: now };
      await db.insert(ideas).values(row); return row;
    }
    case "event": {
      const startAt = requiredIso(data.startAt, "请填写有效的开始时间。 ");
      const endAt = requiredIso(data.endAt, "请填写有效的结束时间。 ");
      if (new Date(endAt) <= new Date(startAt)) throw new InputError("结束时间必须晚于开始时间。 ");
      const row = { id, title, startAt, endAt, allDay: Boolean(data.allDay), notes: optionalText(data.notes ?? data.note), color: optionalText(data.color) || "#159AA9", source: "local", externalId: null, externalCalendarId: null, syncStatus: "pending", projectId: null, archivedAt: null, createdAt: now, updatedAt: now };
      await db.insert(events).values(row); return row;
    }
    case "learningLog": {
      const domainId = requiredText(data.domainId, "请选择学习领域。 ");
      const row = { id, domainId, title, note: optionalText(data.note), minutes: clampNumber(data.minutes, 0, 1_440, 0), occurredAt: requiredIso(data.occurredAt ?? now, "学习时间无效。 "), createdAt: now, updatedAt: now };
      await db.insert(learningLogs).values(row); return row;
    }
    case "knowledgeNote": {
      const kind = knowledgeNoteKind(data.kind);
      const domainId = nullableText(data.domainId);
      if (kind !== "note" && !domainId) throw new InputError("请选择这条认知所属的领域。 ");
      const row = { id, domainId, kind, stage: kind === "stage" ? clampNumber(data.stage, 1, 5, 1) : null, title, content: optionalText(data.note ?? data.content), archivedAt: null, createdAt: now, updatedAt: now };
      await db.insert(knowledgeNotes).values(row); return row;
    }
  }
}

async function updateEntity(entity: EntityName, id: string, data: JsonRecord) {
  const db = getDb();
  const updatedAt = nowIso();
  switch (entity) {
    case "project": {
      const patch = { ...(data.title !== undefined ? { title: requiredText(data.title, "请填写项目名称。") } : {}), ...(data.description !== undefined ? { description: optionalText(data.description) } : {}), ...(data.deadline !== undefined ? { deadline: nullableText(data.deadline) } : {}), updatedAt };
      await db.update(projects).set(patch).where(eq(projects.id, id)); return { id, ...patch };
    }
    case "task": {
      const patch = { ...(data.title !== undefined ? { title: requiredText(data.title, "请填写任务名称。") } : {}), ...(data.status !== undefined ? { status: optionalText(data.status) } : {}), ...(data.notes !== undefined || data.note !== undefined ? { notes: optionalText(data.notes ?? data.note) } : {}), ...(data.projectId !== undefined ? { projectId: nullableText(data.projectId) } : {}), ...(data.domainId !== undefined ? { domainId: nullableText(data.domainId) } : {}), ...(data.plannedDate !== undefined ? { plannedDate: nullableText(data.plannedDate) } : {}), ...(data.dueDate !== undefined ? { dueDate: nullableText(data.dueDate) } : {}), updatedAt };
      await db.update(tasks).set(patch).where(eq(tasks.id, id)); return { id, ...patch };
    }
    case "domain": {
      const patch = { ...(data.title !== undefined ? { title: requiredText(data.title, "请填写领域名称。") } : {}), ...(data.stage !== undefined ? { stage: clampNumber(data.stage, 1, 5, 1) } : {}), ...(data.summary !== undefined ? { summary: optionalText(data.summary) } : {}), ...(data.nextStep !== undefined ? { nextStep: optionalText(data.nextStep) } : {}), updatedAt };
      await db.update(domains).set(patch).where(eq(domains.id, id)); return { id, ...patch };
    }
    case "idea": {
      const patch = { ...(data.title !== undefined ? { title: requiredText(data.title, "请填写内容。") } : {}), ...(data.note !== undefined ? { note: optionalText(data.note) } : {}), ...(data.type !== undefined ? { type: optionalText(data.type) === "question" ? "question" : "idea" } : {}), ...(data.status !== undefined ? { status: optionalText(data.status) } : {}), ...(data.projectId !== undefined ? { projectId: nullableText(data.projectId) } : {}), ...(data.domainId !== undefined ? { domainId: nullableText(data.domainId) } : {}), updatedAt };
      await db.update(ideas).set(patch).where(eq(ideas.id, id)); return { id, ...patch };
    }
    case "event": {
      const startAt = data.startAt !== undefined ? requiredIso(data.startAt, "开始时间无效。") : undefined;
      const endAt = data.endAt !== undefined ? requiredIso(data.endAt, "结束时间无效。") : undefined;
      if (startAt && endAt && new Date(endAt) <= new Date(startAt)) throw new InputError("结束时间必须晚于开始时间。 ");
      const notesProvided = data.notes !== undefined || data.note !== undefined;
      const patch = { ...(data.title !== undefined ? { title: requiredText(data.title, "请填写日程标题。") } : {}), ...(startAt ? { startAt } : {}), ...(endAt ? { endAt } : {}), ...(notesProvided ? { notes: optionalText(data.notes ?? data.note) } : {}), syncStatus: "pending", updatedAt };
      await db.update(events).set(patch).where(eq(events.id, id)); return { id, ...patch };
    }
    case "learningLog": {
      const patch = { ...(data.title !== undefined ? { title: requiredText(data.title, "请填写学习记录。") } : {}), ...(data.note !== undefined ? { note: optionalText(data.note) } : {}), ...(data.minutes !== undefined ? { minutes: clampNumber(data.minutes, 0, 1_440, 0) } : {}), updatedAt };
      await db.update(learningLogs).set(patch).where(eq(learningLogs.id, id)); return { id, ...patch };
    }
    case "knowledgeNote": {
      const kind = data.kind !== undefined ? knowledgeNoteKind(data.kind) : undefined;
      const domainId = data.domainId !== undefined ? nullableText(data.domainId) : undefined;
      if (kind && kind !== "note" && domainId === null) {
        throw new InputError("请选择这条认知所属的领域。 ");
      }
      const patch = {
        ...(data.title !== undefined ? { title: requiredText(data.title, "请填写认知条目标题。") } : {}),
        ...(data.note !== undefined || data.content !== undefined ? { content: optionalText(data.note ?? data.content) } : {}),
        ...(kind ? { kind } : {}),
        ...(domainId !== undefined ? { domainId } : {}),
        ...(kind
          ? { stage: kind === "stage" ? clampNumber(data.stage, 1, 5, 1) : null }
          : data.stage !== undefined
            ? { stage: clampNumber(data.stage, 1, 5, 1) }
            : {}),
        updatedAt,
      };
      await db.update(knowledgeNotes).set(patch).where(eq(knowledgeNotes.id, id)); return { id, ...patch };
    }
  }
}

function requiredText(value: unknown, message: string) {
  if (typeof value !== "string" || !value.trim()) throw new InputError(message);
  return value.trim().slice(0, 240);
}

function optionalText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 8_000) : "";
}

function nullableText(value: unknown) {
  const text = optionalText(value);
  return text || null;
}

function knowledgeNoteKind(value: unknown) {
  const kind = optionalText(value);
  return ["insight", "branch", "stage", "note"].includes(kind) ? kind : "note";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

function requiredIso(value: unknown, message: string) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new InputError(message);
  return new Date(value).toISOString();
}

function workspaceErrorResponse(error: unknown) {
  if (error instanceof InputError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return accessErrorResponse(error);
}
