import { getWorkspaceExportSnapshot } from "./workspace-db";

type JsonObject = Record<string, unknown>;
type WorkspaceSnapshot = Awaited<ReturnType<typeof getWorkspaceExportSnapshot>>;

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonObject;
};

export const mcpToolDefinitions: McpToolDefinition[] = [
  {
    name: "get_today_overview",
    description: "读取指定日期的任务与日程概览，默认使用 Asia/Shanghai 的今天。",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "日期，格式 YYYY-MM-DD；省略时为上海时区的今天。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_tasks",
    description: "按状态、项目、领域或 DDL 范围读取任务。",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["todo", "doing", "done"] },
        projectId: { type: "string" },
        domainId: { type: "string" },
        dueOnOrBefore: { type: "string", description: "包含该日，格式 YYYY-MM-DD。" },
        dueOnOrAfter: { type: "string", description: "包含该日，格式 YYYY-MM-DD。" },
        limit: { type: "integer", minimum: 1, maximum: 200, default: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_projects",
    description: "读取所有进行中的项目，并附带各项目的子目标。",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "可选的项目状态过滤。" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_learning_overview",
    description: "读取领域学习、当前理解、知识条目、阶段总结和学习记录。",
    inputSchema: {
      type: "object",
      properties: {
        domainId: { type: "string", description: "省略时返回全部领域。" },
        includeLogs: { type: "boolean", default: true },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_ideas",
    description: "读取 Ideas 与疑问，可按类型、状态、项目或领域过滤。",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["idea", "question"] },
        status: { type: "string" },
        projectId: { type: "string" },
        domainId: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 200, default: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_workspace_snapshot",
    description: "读取 Personal Workflow 的完整只读快照。仅在需要整体分析时使用。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

export async function callMcpTool(name: string, rawArguments: unknown) {
  const args = asArguments(rawArguments);
  const snapshot = await getWorkspaceExportSnapshot();

  switch (name) {
    case "get_today_overview":
      return getTodayOverview(snapshot, args);
    case "list_tasks":
      return listTasks(snapshot, args);
    case "list_projects":
      return listProjects(snapshot, args);
    case "get_learning_overview":
      return getLearningOverview(snapshot, args);
    case "list_ideas":
      return listIdeas(snapshot, args);
    case "get_workspace_snapshot":
      requireNoArguments(args);
      return { exportedAt: new Date().toISOString(), ...snapshot };
    default:
      throw new Error(`未知工具：${name}`);
  }
}

function getTodayOverview(snapshot: WorkspaceSnapshot, args: JsonObject) {
  rejectUnknownArguments(args, ["date"]);
  const date = optionalDate(args.date) ?? shanghaiDateKey(new Date());
  const tasks = snapshot.tasks.filter((task) => taskAppearsOnDate(task, date));
  const events = snapshot.events.filter(
    (event) => shanghaiDateKey(new Date(event.startAt)) === date,
  );
  return {
    date,
    timezone: "Asia/Shanghai",
    tasks,
    events,
    counts: {
      tasks: tasks.length,
      unfinishedTasks: tasks.filter((task) => task.status !== "done").length,
      events: events.length,
    },
  };
}

function listTasks(snapshot: WorkspaceSnapshot, args: JsonObject) {
  rejectUnknownArguments(args, ["status", "projectId", "domainId", "dueOnOrBefore", "dueOnOrAfter", "limit"]);
  const status = optionalString(args.status);
  if (status && !["todo", "doing", "done"].includes(status)) {
    throw new Error("status 必须是 todo、doing 或 done。");
  }
  const projectId = optionalString(args.projectId);
  const domainId = optionalString(args.domainId);
  const dueOnOrBefore = optionalDate(args.dueOnOrBefore);
  const dueOnOrAfter = optionalDate(args.dueOnOrAfter);
  const limit = optionalLimit(args.limit);
  const tasks = snapshot.tasks
    .filter((task) => !status || task.status === status)
    .filter((task) => !projectId || task.projectId === projectId)
    .filter((task) => !domainId || task.domainId === domainId)
    .filter((task) => !dueOnOrBefore || Boolean(task.dueDate && task.dueDate <= dueOnOrBefore))
    .filter((task) => !dueOnOrAfter || Boolean(task.dueDate && task.dueDate >= dueOnOrAfter))
    .slice(0, limit);
  return { tasks, count: tasks.length };
}

function listProjects(snapshot: WorkspaceSnapshot, args: JsonObject) {
  rejectUnknownArguments(args, ["status"]);
  const status = optionalString(args.status);
  const projects = snapshot.projects
    .filter((project) => !status || project.status === status)
    .map((project) => ({
      ...project,
      subgoals: snapshot.tasks.filter((task) => task.projectId === project.id),
    }));
  return { projects, count: projects.length };
}

function getLearningOverview(snapshot: WorkspaceSnapshot, args: JsonObject) {
  rejectUnknownArguments(args, ["domainId", "includeLogs"]);
  const domainId = optionalString(args.domainId);
  const includeLogs = optionalBoolean(args.includeLogs, true);
  const domains = snapshot.domains
    .filter((domain) => !domainId || domain.id === domainId)
    .map((domain) => ({
      ...domain,
      knowledgeNotes: snapshot.knowledgeNotes.filter((note) => note.domainId === domain.id),
      learningLogs: includeLogs
        ? snapshot.learningLogs.filter((log) => log.domainId === domain.id)
        : undefined,
    }));
  return {
    domains,
    crossDomainNotes: snapshot.knowledgeNotes.filter((note) => note.domainId === null),
    count: domains.length,
  };
}

function listIdeas(snapshot: WorkspaceSnapshot, args: JsonObject) {
  rejectUnknownArguments(args, ["type", "status", "projectId", "domainId", "limit"]);
  const type = optionalString(args.type);
  if (type && !["idea", "question"].includes(type)) {
    throw new Error("type 必须是 idea 或 question。");
  }
  const status = optionalString(args.status);
  const projectId = optionalString(args.projectId);
  const domainId = optionalString(args.domainId);
  const limit = optionalLimit(args.limit);
  const ideas = snapshot.ideas
    .filter((idea) => !type || idea.type === type)
    .filter((idea) => !status || idea.status === status)
    .filter((idea) => !projectId || idea.projectId === projectId)
    .filter((idea) => !domainId || idea.domainId === domainId)
    .slice(0, limit);
  return { ideas, count: ideas.length };
}

function taskAppearsOnDate(task: WorkspaceSnapshot["tasks"][number], date: string) {
  const plannedDate = task.plannedDate ?? "";
  const dueDate = task.dueDate ?? "";
  const timedForDate = Boolean(
    task.startAt && shanghaiDateKey(new Date(task.startAt)) === date,
  );
  const explicitlyOnDate = plannedDate === date || dueDate === date;
  const hasStarted = plannedDate
    ? plannedDate <= date
    : Boolean(dueDate && dueDate <= date);
  return timedForDate || explicitlyOnDate || (task.status !== "done" && hasStarted);
}

function shanghaiDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function asArguments(value: unknown): JsonObject {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("工具参数必须是对象。");
  }
  return value as JsonObject;
}

function requireNoArguments(args: JsonObject) {
  rejectUnknownArguments(args, []);
}

function rejectUnknownArguments(args: JsonObject, allowed: string[]) {
  const unknown = Object.keys(args).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new Error(`不支持的参数：${unknown.join("、")}`);
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("文本参数格式无效。");
  return value;
}

function optionalDate(value: unknown) {
  const date = optionalString(value);
  if (!date) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("日期必须使用 YYYY-MM-DD 格式。");
  return date;
}

function optionalBoolean(value: unknown, fallback: boolean) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error("布尔参数格式无效。");
  return value;
}

function optionalLimit(value: unknown) {
  if (value === undefined) return 100;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 200) {
    throw new Error("limit 必须是 1 到 200 之间的整数。");
  }
  return value as number;
}
