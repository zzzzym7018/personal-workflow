"use client";

import type {
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ViewKey =
  | "today"
  | "calendar"
  | "projects"
  | "learning"
  | "ideas"
  | "review"
  | "settings";
type EntityName =
  | "project"
  | "task"
  | "domain"
  | "idea"
  | "event"
  | "learningLog"
  | "knowledgeNote";
type Viewer = { displayName: string; email: string; isPreview: boolean };
type Project = {
  id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  color: string;
  deadline: string | null;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};
type Task = {
  id: string;
  projectId: string | null;
  domainId: string | null;
  title: string;
  notes: string;
  status: string;
  priority: string;
  dueDate: string | null;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
};
type Domain = {
  id: string;
  title: string;
  stage: number;
  summary: string;
  nextStep: string;
  color: string;
  createdAt: string;
  updatedAt: string;
};
type LearningLog = {
  id: string;
  domainId: string;
  title: string;
  note: string;
  minutes: number;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};
type KnowledgeNote = {
  id: string;
  domainId: string | null;
  kind: "insight" | "branch" | "stage" | "note";
  stage: number | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};
type Idea = {
  id: string;
  title: string;
  note: string;
  type: string;
  status: string;
  projectId: string | null;
  domainId: string | null;
  createdAt: string;
  updatedAt: string;
};
type CalendarEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  notes: string;
  color: string;
  source: string;
  externalId: string | null;
  externalCalendarId: string | null;
  syncStatus: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
};
type Snapshot = {
  projects: Project[];
  tasks: Task[];
  domains: Domain[];
  learningLogs: LearningLog[];
  knowledgeNotes: KnowledgeNote[];
  ideas: Idea[];
  events: CalendarEvent[];
  viewer: Viewer;
};
type GoogleCalendar = {
  id: string;
  calendarId: string;
  name: string;
  color: string;
  selected: boolean;
  writable: boolean;
  isPrimary: boolean;
};
type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  googleEmail: string | null;
  lastSyncAt: string | null;
  calendars: GoogleCalendar[];
};
type Toast = {
  id: string;
  message: string;
  tone: "success" | "warning" | "error" | "info";
};
type EditorDraft = Record<string, string>;
type DeleteTarget = {
  entity: "event" | "task" | "project";
  id: string;
  title: string;
  description: string;
};

const navigation: Array<{ key: ViewKey; label: string; mark: string }> = [
  { key: "today", label: "今日", mark: "今" },
  { key: "calendar", label: "日程", mark: "历" },
  { key: "projects", label: "项目", mark: "项" },
  { key: "learning", label: "领域学习", mark: "域" },
  { key: "ideas", label: "Ideas 与疑问", mark: "问" },
  { key: "review", label: "回顾", mark: "顾" },
  { key: "settings", label: "设置", mark: "设" },
];

const viewTitles: Record<ViewKey, string> = {
  today: "今日",
  calendar: "日程",
  projects: "项目",
  learning: "领域学习",
  ideas: "Ideas 与疑问",
  review: "回顾",
  settings: "设置",
};

const stageLabels = [
  "尚未开始",
  "建立框架",
  "深入理解",
  "可以解释",
  "可以应用或输出",
];

const subgoalStatuses = [
  { value: "todo", label: "未开启" },
  { value: "doing", label: "进行中" },
  { value: "done", label: "已完成" },
] as const;

export function WorkspaceApp({ initialViewer }: { initialViewer: Viewer }) {
  const [activeView, setActiveView] = useState<ViewKey>("today");
  const [navigationReady, setNavigationReady] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<EntityName | null>(null);
  const [editorTargetId, setEditorTargetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditorDraft>({});
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<{
    entity: Exclude<EntityName, "learningLog" | "knowledgeNote">;
    id: string;
    title: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const quickAddRef = useRef<HTMLButtonElement>(null);
  const editorReturnFocusIdRef = useRef<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const view = new URLSearchParams(window.location.search).get(
        "view",
      ) as ViewKey | null;
      if (view && navigation.some((item) => item.key === view))
        setActiveView(view);
      setNavigationReady(true);
    });
  }, []);

  const notify = useCallback(
    (message: string, tone: Toast["tone"] = "success") => {
      const id = crypto.randomUUID();
      setToasts((items) => {
        if (items.some((item) => item.message === message)) return items;
        return [...items.slice(-2), { id, message, tone }];
      });
      window.setTimeout(
        () => setToasts((items) => items.filter((item) => item.id !== id)),
        4500,
      );
    },
    [],
  );

  const loadWorkspace = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/workspace", { signal });
    if (!response.ok) throw new Error("工作台数据暂时无法读取。 ");
    setSnapshot((await response.json()) as Snapshot);
  }, []);

  const loadGoogleStatus = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/google/status", { signal });
    if (response.ok) setGoogleStatus((await response.json()) as GoogleStatus);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      Promise.all([
        loadWorkspace(controller.signal),
        loadGoogleStatus(controller.signal),
      ])
        .catch((reason: unknown) => {
          if (!(reason instanceof DOMException && reason.name === "AbortError"))
            setError(
              reason instanceof Error
                ? reason.message
                : "工作台暂时无法读取。 ",
            );
        })
        .finally(() => setLoading(false));
    });
    return () => controller.abort();
  }, [loadGoogleStatus, loadWorkspace]);

  useEffect(() => {
    if (!navigationReady) return;
    document.title = `${viewTitles[activeView]} — 知行台`;
    const url = new URL(window.location.href);
    url.searchParams.set("view", activeView);
    window.history.replaceState({ view: activeView }, "", url);
  }, [activeView, navigationReady]);

  useEffect(() => {
    const onPopState = () => {
      const view = new URLSearchParams(window.location.search).get(
        "view",
      ) as ViewKey | null;
      if (view && navigation.some((item) => item.key === view))
        setActiveView(view);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches(
        "input, textarea, select, [contenteditable='true']",
      );
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !event.isComposing
      ) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "n" &&
        !event.isComposing &&
        !isTyping
      ) {
        event.preventDefault();
        openEditor("task");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function navigate(view: ViewKey) {
    setActiveView(view);
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.pushState({ view }, "", url);
    document.querySelector<HTMLElement>("#workspace-main")?.focus();
  }

  function openEditor(entity: EntityName, defaults: EditorDraft = {}) {
    const date = localDateKey(new Date());
    editorReturnFocusIdRef.current = null;
    setEditor(entity);
    setEditorTargetId(null);
    setEditorError("");
    setDraft({
      type: entity === "idea" ? "idea" : "",
      kind: entity === "knowledgeNote" ? "insight" : "",
      date,
      dueDate: entity === "task" ? date : "",
      start: "09:00",
      end: "10:00",
      occurredDate: date,
      minutes: "45",
      stage: "1",
      ...defaults,
    });
  }

  function openEventEditor(event: CalendarEvent) {
    editorReturnFocusIdRef.current = null;
    setEditor("event");
    setEditorTargetId(event.id);
    setEditorError("");
    setDraft({
      title: event.title,
      date: localDateKey(new Date(event.startAt)),
      start: formatTime(event.startAt),
      end: formatTime(event.endAt),
      note: event.notes,
    });
  }

  function openTaskEditor(task: Task) {
    editorReturnFocusIdRef.current = `agenda-task-${task.id}`;
    setEditor("task");
    setEditorTargetId(task.id);
    setEditorError("");
    setDraft({
      title: task.title,
      dueDate: task.dueDate ?? "",
      projectId: task.projectId ?? "",
      domainId: task.domainId ?? "",
      note: task.notes,
    });
  }

  function openProjectEditor(project: Project) {
    editorReturnFocusIdRef.current = `project-edit-${project.id}`;
    setEditor("project");
    setEditorTargetId(project.id);
    setEditorError("");
    setDraft({
      title: project.title,
      description: project.description,
      deadline: project.deadline ?? "",
    });
  }

  function openIdeaEditor(idea: Idea) {
    editorReturnFocusIdRef.current = `idea-edit-${idea.id}`;
    setEditor("idea");
    setEditorTargetId(idea.id);
    setEditorError("");
    setDraft({
      title: idea.title,
      type: idea.type,
      note: idea.note,
      status: idea.status,
      projectId: idea.projectId ?? "",
      domainId: idea.domainId ?? "",
    });
  }

  function openDomainEditor(domain: Domain) {
    editorReturnFocusIdRef.current = `domain-select-${domain.id}`;
    setEditor("domain");
    setEditorTargetId(domain.id);
    setEditorError("");
    setDraft({
      title: domain.title,
      stage: String(domain.stage),
      summary: domain.summary,
      nextStep: domain.nextStep,
    });
  }

  function openKnowledgeNoteEditor(note: KnowledgeNote) {
    editorReturnFocusIdRef.current = `knowledge-note-${note.id}`;
    setEditor("knowledgeNote");
    setEditorTargetId(note.id);
    setEditorError("");
    setDraft({
      title: note.title,
      kind: note.kind,
      stage: String(note.stage ?? 1),
      domainId: note.domainId ?? "",
      note: note.content,
    });
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setEditorError("");
    if (!draft.title?.trim()) {
      setEditorError("请先填写标题。 ");
      document.querySelector<HTMLElement>("#editor-title")?.focus();
      return;
    }
    const data: Record<string, unknown> = { ...draft };
    if (editor === "event") {
      const startAt = parseShanghaiDateTime(draft.date, draft.start);
      const endAt = parseShanghaiDateTime(draft.date, draft.end);
      if (!startAt || !endAt) {
        setEditorError("请按 YYYY-MM-DD 和 HH:mm 格式填写时间。 ");
        return;
      }
      data.startAt = startAt;
      data.endAt = endAt;
      data.notes = draft.note ?? "";
    }
    if (editor === "learningLog") {
      data.occurredAt = parseShanghaiDateTime(draft.occurredDate, "12:00");
      data.minutes = Number(draft.minutes);
    }
    setSaving(true);
    try {
      const editing = Boolean(editorTargetId);
      const response = await fetch("/api/workspace", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: editor,
          ...(editorTargetId ? { id: editorTargetId } : {}),
          data,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(
          result.error || (editing ? "保存失败，请重试。 " : "创建失败，请重试。 "),
        );
      await loadWorkspace();
      const returnFocusId = editorReturnFocusIdRef.current;
      editorReturnFocusIdRef.current = null;
      setEditor(null);
      setEditorTargetId(null);
      notify(
        editing
          ? `${entityLabel(editor)}已更新`
          : editor === "task" && draft.projectId
            ? "子目标已创建"
            : `${entityLabel(editor)}已创建`,
      );
      window.setTimeout(
        () =>
          (returnFocusId
            ? document.getElementById(returnFocusId)
            : document.querySelector<HTMLElement>("#workspace-main"))?.focus(),
        0,
      );
    } catch (reason) {
      setEditorError(
        reason instanceof Error ? reason.message : "保存失败，请重试。 ",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateItem(
    entity: EntityName,
    id: string,
    data: Record<string, unknown>,
    message = "更改已保存",
  ) {
    try {
      const response = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity, id, data }),
      });
      if (!response.ok) throw new Error();
      await loadWorkspace();
      notify(message);
    } catch {
      notify("更改未保存，请重试", "error");
    }
  }

  async function archiveItem() {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      const response = await fetch("/api/workspace", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: archiveTarget.entity,
          id: archiveTarget.id,
        }),
      });
      if (!response.ok) throw new Error();
      await loadWorkspace();
      setArchiveTarget(null);
      notify("已归档", "warning");
    } catch {
      notify("未能归档，请重试", "error");
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(target: DeleteTarget) {
    setDeleteError("");
    setDeleteTarget(target);
  }

  async function deleteItem() {
    if (!deleteTarget) return;
    setDeleteError("");
    setSaving(true);
    try {
      const response = await fetch("/api/workspace", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: deleteTarget.entity,
          id: deleteTarget.id,
          action: "delete",
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "删除失败，请重试。 ");
      await loadWorkspace();
      const deletedEditorTarget = editorTargetId === deleteTarget.id;
      setDeleteTarget(null);
      if (deletedEditorTarget) {
        editorReturnFocusIdRef.current = null;
        setEditor(null);
        setEditorTargetId(null);
      }
      notify(`${entityLabel(deleteTarget.entity)}已永久删除`, "warning");
      window.setTimeout(
        () => document.querySelector<HTMLElement>("#workspace-main")?.focus(),
        0,
      );
    } catch (reason) {
      setDeleteError(
        reason instanceof Error ? reason.message : "删除失败，请重试。 ",
      );
    } finally {
      setSaving(false);
    }
  }

  async function syncGoogle() {
    setSyncing(true);
    try {
      const response = await fetch("/api/google/sync", { method: "POST" });
      const result = (await response.json()) as {
        imported?: number;
        exported?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "同步失败");
      await Promise.all([loadWorkspace(), loadGoogleStatus()]);
      notify(
        `同步完成：读取 ${result.imported ?? 0}，写入 ${result.exported ?? 0}`,
      );
    } catch (reason) {
      notify(
        reason instanceof Error ? reason.message : "同步失败，请重试",
        "error",
      );
    } finally {
      setSyncing(false);
    }
  }

  const viewer = snapshot?.viewer ?? initialViewer;
  const today = new Date();
  const todayKey = localDateKey(today);
  const todayEvents = useMemo(
    () =>
      (snapshot?.events ?? []).filter(
        (item) => localDateKey(new Date(item.startAt)) === todayKey,
      ),
    [snapshot, todayKey],
  );
  return (
    <div className="workspace-shell">
      <aside className="sidebar" aria-label="主要导航">
        <div className="brand-lockup">
          <span className="brand-mark">知</span>
          <div>
            <strong>知行台</strong>
            <span>PERSONAL DESK</span>
          </div>
        </div>
        <nav className="nav-list">
          {navigation.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeView === item.key ? "is-current" : ""}`}
              type="button"
              aria-current={activeView === item.key ? "page" : undefined}
              onClick={() => navigate(item.key)}
            >
              <span className="nav-mark" aria-hidden="true">
                {item.mark}
              </span>
              <span>{item.label}</span>
              {item.key === "ideas" && snapshot ? (
                <span className="nav-count">
                  {
                    snapshot.ideas.filter((idea) => idea.status !== "resolved")
                      .length
                  }
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="profile-mark" aria-hidden="true">
            {viewer.displayName.slice(0, 1)}
          </div>
          <div>
            <strong>{viewer.displayName}</strong>
            <span>{viewer.isPreview ? "本地预览" : "私人空间"}</span>
          </div>
        </div>
      </aside>

      <div className="workspace-frame">
        <header className="topbar">
          <div>
            <p className="eyebrow">{formatFullDate(today)}</p>
            <h1>{viewTitles[activeView]}</h1>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              type="button"
              onClick={() => setSearchOpen(true)}
            >
              <span>搜索任务、项目或问题</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              ref={quickAddRef}
              className="button button--primary"
              type="button"
              onClick={() =>
                openEditor(
                  activeView === "calendar"
                    ? "event"
                    : activeView === "projects"
                      ? "project"
                    : activeView === "ideas"
                      ? "idea"
                      : activeView === "learning"
                        ? "learningLog"
                        : "task",
                )
              }
            >
              ＋ 快速添加
            </button>
          </div>
        </header>

        {viewer.isPreview ? (
          <div className="preview-banner" role="status">
            <span>本地预览模式</span>
            <span>上线后将启用私人账号校验和 Google Calendar 授权。</span>
          </div>
        ) : null}
        {error ? (
          <div className="page-alert" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setError("");
                setLoading(true);
                loadWorkspace()
                  .catch(() => setError("仍然无法读取数据。 "))
                  .finally(() => setLoading(false));
              }}
            >
              重试
            </button>
          </div>
        ) : null}

        <main id="workspace-main" className="workspace-main" tabIndex={-1}>
          {loading ? (
            <LoadingRegion />
          ) : snapshot ? (
            <>
              {activeView === "today" ? (
                <TodayView
                  snapshot={snapshot}
                  todayEvents={todayEvents}
                  todayKey={todayKey}
                  onNavigate={navigate}
                  onToggleTask={(task) =>
                    updateItem(
                      "task",
                      task.id,
                      { status: task.status === "done" ? "todo" : "done" },
                      task.status === "done" ? "任务已重新打开" : "任务已完成",
                    )
                  }
                  onOpenEditor={openEditor}
                  onEditEvent={openEventEditor}
                  onDeleteTask={(task) =>
                    requestDelete({
                      entity: "task",
                      id: task.id,
                      title: task.title,
                      description: task.projectId
                        ? "该子目标将从所属项目中永久删除，且无法恢复。"
                        : "该任务将被永久删除，且无法恢复。",
                    })
                  }
                />
              ) : null}
              {activeView === "calendar" ? (
                <CalendarView
                  events={snapshot.events}
                  tasks={snapshot.tasks}
                  projects={snapshot.projects}
                  onCreate={(defaults) => openEditor("event", defaults)}
                  onEdit={openEventEditor}
                  onEditTask={openTaskEditor}
                  onToggleTask={(task) =>
                    updateItem(
                      "task",
                      task.id,
                      { status: "done" },
                      "任务已完成",
                    )
                  }
                  onArchive={(item) =>
                    setArchiveTarget({
                      entity: "event",
                      id: item.id,
                      title: item.title,
                    })
                  }
                  onDelete={(item) =>
                    requestDelete({
                      entity: "event",
                      id: item.id,
                      title: item.title,
                      description:
                        item.externalCalendarId && item.externalId
                          ? "该日程将同时从 Google Calendar 和知行台永久删除，且无法恢复。"
                          : "该日程将从知行台永久删除，且无法恢复。",
                    })
                  }
                  onDeleteTask={(task) =>
                    requestDelete({
                      entity: "task",
                      id: task.id,
                      title: task.title,
                      description: task.projectId
                        ? "该子目标将从所属项目中永久删除，且无法恢复。"
                        : "该任务将被永久删除，且无法恢复。",
                    })
                  }
                  googleStatus={googleStatus}
                  onSync={syncGoogle}
                  syncing={syncing}
                />
              ) : null}
              {activeView === "projects" ? (
                <ProjectsView
                  projects={snapshot.projects}
                  tasks={snapshot.tasks}
                  onCreate={() => openEditor("project")}
                  onEdit={openProjectEditor}
                  onCreateSubgoal={(projectId) =>
                    openEditor("task", { projectId, dueDate: "" })
                  }
                  onUpdate={updateItem}
                  onArchive={(item) =>
                    setArchiveTarget({
                      entity: "project",
                      id: item.id,
                      title: item.title,
                    })
                  }
                  onDelete={(item) => {
                    const childCount = snapshot.tasks.filter(
                      (task) => task.projectId === item.id,
                    ).length;
                    requestDelete({
                      entity: "project",
                      id: item.id,
                      title: item.title,
                      description: `该项目及其 ${childCount} 个子目标将被永久删除；关联的 Ideas 会保留并取消项目关联。此操作无法恢复。`,
                    });
                  }}
                  onDeleteTask={(task) =>
                    requestDelete({
                      entity: "task",
                      id: task.id,
                      title: task.title,
                      description: "该子目标将从所属项目中永久删除，且无法恢复。",
                    })
                  }
                />
              ) : null}
              {activeView === "learning" ? (
                <LearningView
                  domains={snapshot.domains}
                  logs={snapshot.learningLogs}
                  notes={snapshot.knowledgeNotes}
                  onCreateDomain={() => openEditor("domain")}
                  onEditDomain={openDomainEditor}
                  onCreateLog={() => openEditor("learningLog")}
                  onCreateNote={(defaults) =>
                    openEditor("knowledgeNote", defaults)
                  }
                  onEditNote={openKnowledgeNoteEditor}
                  onUpdate={updateItem}
                />
              ) : null}
              {activeView === "ideas" ? (
                <IdeasView
                  ideas={snapshot.ideas}
                  projects={snapshot.projects}
                  domains={snapshot.domains}
                  onCreate={() => openEditor("idea")}
                  onEdit={openIdeaEditor}
                  onUpdate={updateItem}
                  onArchive={(item) =>
                    setArchiveTarget({
                      entity: "idea",
                      id: item.id,
                      title: item.title,
                    })
                  }
                />
              ) : null}
              {activeView === "review" ? (
                <ReviewView snapshot={snapshot} />
              ) : null}
              {activeView === "settings" ? (
                <SettingsView
                  viewer={viewer}
                  googleStatus={googleStatus}
                  setGoogleStatus={setGoogleStatus}
                  onRefresh={loadGoogleStatus}
                  onSync={syncGoogle}
                  syncing={syncing}
                  notify={notify}
                />
              ) : null}
            </>
          ) : null}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="移动端主要导航">
        {navigation.slice(0, 5).map((item) => (
          <button
            key={item.key}
            type="button"
            className={activeView === item.key ? "is-current" : ""}
            aria-current={activeView === item.key ? "page" : undefined}
            onClick={() => navigate(item.key)}
          >
            <span aria-hidden="true">{item.mark}</span>
            {item.label.replace("Ideas 与疑问", "Ideas")}
          </button>
        ))}
      </nav>

      {editor ? (
        <EditorDialog
          entity={editor}
          draft={draft}
          setDraft={setDraft}
          error={editorError}
          saving={saving}
          editing={Boolean(editorTargetId)}
          suspended={Boolean(deleteTarget)}
          snapshot={snapshot}
          onClose={() => {
            const returnFocusId = editorReturnFocusIdRef.current;
            editorReturnFocusIdRef.current = null;
            setEditor(null);
            setEditorTargetId(null);
            window.setTimeout(
              () =>
                (returnFocusId
                  ? document.getElementById(returnFocusId)
                  : quickAddRef.current)?.focus(),
              0,
            );
          }}
          onSubmit={createItem}
          onDelete={
            editorTargetId &&
            (editor === "event" || editor === "project" || editor === "domain")
              ? () => {
                  if (editor === "event") {
                    const item = snapshot?.events.find(
                      (event) => event.id === editorTargetId,
                    );
                    if (item)
                      requestDelete({
                        entity: "event",
                        id: item.id,
                        title: item.title,
                        description:
                          item.externalCalendarId && item.externalId
                            ? "该日程将同时从 Google Calendar 和知行台永久删除，且无法恢复。"
                            : "该日程将从知行台永久删除，且无法恢复。",
                      });
                  } else if (editor === "project") {
                    const item = snapshot?.projects.find(
                      (project) => project.id === editorTargetId,
                    );
                    if (item) {
                      const childCount =
                        snapshot?.tasks.filter(
                          (task) => task.projectId === item.id,
                        ).length ?? 0;
                      requestDelete({
                        entity: "project",
                        id: item.id,
                        title: item.title,
                        description: `该项目及其 ${childCount} 个子目标将被永久删除；关联的 Ideas 会保留并取消项目关联。此操作无法恢复。`,
                      });
                    }
                  } else {
                    const item = snapshot?.domains.find(
                      (domain) => domain.id === editorTargetId,
                    );
                    if (item) {
                      const knowledgeCount =
                        snapshot?.knowledgeNotes.filter(
                          (note) => note.domainId === item.id,
                        ).length ?? 0;
                      const logCount =
                        snapshot?.learningLogs.filter(
                          (log) => log.domainId === item.id,
                        ).length ?? 0;
                      requestDelete({
                        entity: "domain",
                        id: item.id,
                        title: item.title,
                        description: `该领域及其 ${knowledgeCount} 条认知与笔记、${logCount} 条学习记录将被永久删除；关联的任务与 Ideas 会保留并取消领域关联。此操作无法恢复。`,
                      });
                    }
                  }
                }
              : undefined
          }
        />
      ) : null}
      {searchOpen ? (
        <SearchDialog
          snapshot={snapshot}
          query={searchQuery}
          setQuery={setSearchQuery}
          onClose={() => setSearchOpen(false)}
          onNavigate={(view) => {
            setSearchOpen(false);
            navigate(view);
          }}
        />
      ) : null}
      {archiveTarget ? (
        <ConfirmDialog
          title={`归档「${archiveTarget.title}」？`}
          description="归档后它会从当前视图隐藏，但不会永久删除。"
          confirmLabel="归档"
          saving={saving}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={archiveItem}
        />
      ) : null}
      {deleteTarget ? (
        <ConfirmDialog
          tone="danger"
          mark="删"
          title={`永久删除「${deleteTarget.title}」？`}
          description={deleteTarget.description}
          confirmLabel="永久删除"
          savingLabel="正在删除…"
          error={deleteError}
          saving={saving}
          onCancel={() => {
            setDeleteError("");
            setDeleteTarget(null);
          }}
          onConfirm={deleteItem}
        />
      ) : null}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.tone}`}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              aria-label="关闭提示"
              onClick={() =>
                setToasts((items) =>
                  items.filter((item) => item.id !== toast.id),
                )
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TodayView({
  snapshot,
  todayEvents,
  todayKey,
  onNavigate,
  onToggleTask,
  onOpenEditor,
  onEditEvent,
  onDeleteTask,
}: {
  snapshot: Snapshot;
  todayEvents: CalendarEvent[];
  todayKey: string;
  onNavigate: (view: ViewKey) => void;
  onToggleTask: (task: Task) => void;
  onOpenEditor: (entity: EntityName, defaults?: EditorDraft) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteTask: (task: Task) => void;
}) {
  const now = useCurrentTime();
  const todayTasks = snapshot.tasks.filter(
    (task) =>
      task.dueDate === todayKey ||
      (task.startAt && localDateKey(new Date(task.startAt)) === todayKey),
  );
  const currentEvent = todayEvents.find(
    (item) =>
      new Date(item.startAt).getTime() <= now &&
      now < new Date(item.endAt).getTime(),
  );
  const currentTask = snapshot.tasks.find(
    (task) =>
      task.status !== "done" &&
      task.startAt &&
      task.endAt &&
      new Date(task.startAt).getTime() <= now &&
      now < new Date(task.endAt).getTime(),
  );
  const currentSlot = currentEvent
    ? {
        title: currentEvent.title,
        startAt: currentEvent.startAt,
        endAt: currentEvent.endAt,
        projectId: currentEvent.projectId,
        kind: "event" as const,
      }
    : currentTask?.startAt && currentTask.endAt
      ? {
          title: currentTask.title,
          startAt: currentTask.startAt,
          endAt: currentTask.endAt,
          projectId: currentTask.projectId,
          kind: "task" as const,
        }
      : null;
  return (
    <div className="today-layout page-enter">
      <section className="today-primary">
        <div className={`current-slot-card ${currentSlot ? "is-active" : ""}`}>
          <div className="current-slot-accent" aria-hidden="true" />
          <div>
            <p className="eyebrow">当前时段 · NOW</p>
            <h2>{currentSlot?.title ?? "当前时段暂无安排"}</h2>
            <p>
              {currentSlot
                ? `${formatTime(currentSlot.startAt)}—${formatTime(currentSlot.endAt)} · ${
                    currentSlot.kind === "task"
                      ? currentSlot.projectId
                        ? "项目子目标"
                        : "计划任务"
                      : "日程"
                  }`
                : "查看下方时间轨，或为当前时段添加一项安排。"}
            </p>
          </div>
          <button
            className="button button--outline"
            type="button"
            onClick={() =>
              currentSlot ? onNavigate("calendar") : onOpenEditor("event")
            }
          >
            {currentSlot ? "查看日程" : "安排当前时段"}
          </button>
        </div>
        <Timeline
          events={todayEvents}
          now={now}
          dateKey={todayKey}
          onCreateAt={(defaults) => onOpenEditor("event", defaults)}
          onEditEvent={onEditEvent}
        />
      </section>
      <aside className="context-column">
        <section className="panel compact-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">TODAY</p>
              <h2>今日行动</h2>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => onOpenEditor("task")}
            >
              添加任务
            </button>
          </div>
          <div
            className="task-list scroll-region"
            tabIndex={todayTasks.length ? 0 : undefined}
            aria-label={`今日行动，共 ${todayTasks.length} 项`}
          >
            {todayTasks.length ? (
              todayTasks.map((task) => (
                <div key={task.id} className="task-row">
                  <input
                    type="checkbox"
                    aria-label={`${task.status === "done" ? "重新打开" : "完成"} ${task.title}`}
                    checked={task.status === "done"}
                    onChange={() => onToggleTask(task)}
                  />
                  <span className={task.status === "done" ? "is-done" : ""}>
                    {task.title}
                  </span>
                  <span className="tag">
                    {task.projectId ? "子目标" : "任务"}
                  </span>
                  <button
                    className="row-action row-action--delete"
                    type="button"
                    aria-label={`删除${task.projectId ? "子目标" : "任务"} ${task.title}`}
                    title="删除"
                    onClick={() => onDeleteTask(task)}
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <EmptyState
                title="今天还没有任务"
                description="先添加一个具体、可完成的行动。"
                action="添加任务"
                onAction={() => onOpenEditor("task")}
              />
            )}
          </div>
        </section>
        <section className="panel compact-panel">
          <div className="panel-heading">
            <h2>推进中的项目</h2>
            <button
              className="text-button"
              type="button"
              onClick={() => onNavigate("projects")}
            >
              项目看板
            </button>
          </div>
          <div
            className="project-list scroll-region"
            tabIndex={snapshot.projects.length ? 0 : undefined}
            aria-label={`推进中的项目，共 ${snapshot.projects.length} 项`}
          >
            {snapshot.projects.map((project) => (
              <ProjectSummaryItem
                key={project.id}
                project={project}
                tasks={snapshot.tasks}
              />
            ))}
          </div>
        </section>
        <section className="panel compact-panel">
          <div className="panel-heading">
            <h2>领域学习</h2>
            <button
              className="text-button"
              type="button"
              onClick={() => onNavigate("learning")}
            >
              认知档案
            </button>
          </div>
          <div className="domain-mini-grid">
            {snapshot.domains.map((domain) => (
              <button
                key={domain.id}
                type="button"
                onClick={() => onNavigate("learning")}
              >
                <strong>{domain.title}</strong>
                <span>{stageLabels[domain.stage - 1]}</span>
                <StageMeter stage={domain.stage} />
              </button>
            ))}
          </div>
        </section>
        <section className="panel compact-panel question-panel">
          <div className="panel-heading">
            <h2>待探索的问题</h2>
            <button
              className="text-button"
              type="button"
              onClick={() => onNavigate("ideas")}
            >
              查看全部
            </button>
          </div>
          <button
            className="question-entry"
            type="button"
            onClick={() => onNavigate("ideas")}
          >
            <span className="question-entry-mark" aria-hidden="true">
              问
            </span>
            <span className="question-entry-copy">
              <small>正在探索</small>
              <strong>
                {snapshot.ideas.find(
                  (idea) =>
                    idea.type === "question" && idea.status !== "resolved",
                )?.title ?? "记录一个仍未解决的问题"}
              </strong>
            </span>
            <span className="question-entry-arrow" aria-hidden="true">
              →
            </span>
          </button>
        </section>
      </aside>
    </div>
  );
}

function ProjectSummaryItem({
  project,
  tasks,
}: {
  project: Project;
  tasks: Task[];
}) {
  const subgoals = tasks.filter((task) => task.projectId === project.id);
  const completed = subgoals.filter((task) => task.status === "done").length;
  const nextSubgoal = subgoals.find((task) => task.status !== "done");
  return (
    <div className="project-summary-item">
      <div>
        <strong>{project.title}</strong>
        <span>
          {completed}/{subgoals.length} 完成
        </span>
      </div>
      <p>
        {nextSubgoal
          ? `下一项 · ${nextSubgoal.title}`
          : subgoals.length
            ? "所有子目标已完成"
            : "还没有子目标"}
      </p>
    </div>
  );
}

function Timeline({
  events,
  now,
  dateKey,
  onCreateAt,
  onEditEvent,
}: {
  events: CalendarEvent[];
  now: number;
  dateKey: string;
  onCreateAt: (defaults: EditorDraft) => void;
  onEditEvent: (event: CalendarEvent) => void;
}) {
  const hours = Array.from({ length: 17 }, (_, index) => index + 8);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentPosition = nowPosition(now);

  useEffect(() => {
    const scrollArea = scrollRef.current;
    if (!scrollArea) return;
    const minute = Math.max(
      8 * 60,
      Math.min(24 * 60, shanghaiClockMinutes(new Date())),
    );
    const ratio = (minute - 8 * 60) / (16 * 60);
    scrollArea.scrollTop = Math.max(
      0,
      ratio * scrollArea.scrollHeight - scrollArea.clientHeight * 0.34,
    );
  }, []);

  function createFromRail(event: ReactMouseEvent<HTMLButtonElement>) {
    const currentMinute = shanghaiClockMinutes(new Date(now));
    const minute =
      event.detail === 0
        ? Math.ceil(currentMinute / 15) * 15
        : 8 * 60 +
          Math.round(
            ((event.clientY - event.currentTarget.getBoundingClientRect().top) /
              event.currentTarget.getBoundingClientRect().height) *
              64,
          ) *
            15;
    onCreateAt(eventDraft(dateKey, minute));
  }

  return (
    <section className="panel timeline-panel" aria-labelledby="timeline-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">TIME RAIL</p>
          <h2 id="timeline-title">今天的时间</h2>
        </div>
        <div className="timeline-heading-meta">
          <span>08:00—24:00 · Asia / Shanghai</span>
          <small>点击空白时间快速添加</small>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="timeline-scroll"
        tabIndex={0}
        aria-label="今日时间轨，早上八点至晚上十二点"
      >
        <div
          className="timeline"
          style={{ "--timeline-hours": hours.length - 1 } as CSSProperties}
        >
          <button
            className="timeline-create-layer"
            type="button"
            aria-label="在时间轨选择时间并新建日程"
            onClick={createFromRail}
          />
          {hours.map((hour) => (
            <div
              className="timeline-hour"
              key={hour}
              style={{ "--hour-index": hour - 8 } as CSSProperties}
            >
              <time>{String(hour).padStart(2, "0")}:00</time>
              <span />
            </div>
          ))}
          {currentPosition ? (
            <div
              className="now-line"
              style={{ "--now-position": currentPosition } as CSSProperties}
            >
              <span>现在</span>
            </div>
          ) : null}
          {events.map((event) => {
            const geometry = eventGeometry(event);
            const isCurrent =
              new Date(event.startAt).getTime() <= now &&
              now < new Date(event.endAt).getTime();
            return (
              <button
                type="button"
                key={event.id}
                className={`timeline-event ${isCurrent ? "is-current" : ""}`}
                style={
                  {
                    "--event-top": geometry.top,
                    "--event-height": geometry.height,
                    "--event-color": event.color,
                  } as CSSProperties
                }
                aria-label={`编辑日程 ${event.title}，${formatTime(event.startAt)} 至 ${formatTime(event.endAt)}`}
                onClick={() => onEditEvent(event)}
              >
                <div>
                  <strong>{event.title}</strong>
                  <span>
                    {event.source === "google"
                      ? "Google Calendar"
                      : "站内日程"}
                  </span>
                </div>
                <time>
                  {formatTime(event.startAt)}—{formatTime(event.endAt)}
                </time>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CalendarView({
  events,
  tasks,
  projects,
  onCreate,
  onEdit,
  onEditTask,
  onToggleTask,
  onArchive,
  onDelete,
  onDeleteTask,
  googleStatus,
  onSync,
  syncing,
}: {
  events: CalendarEvent[];
  tasks: Task[];
  projects: Project[];
  onCreate: (defaults?: EditorDraft) => void;
  onEdit: (event: CalendarEvent) => void;
  onEditTask: (task: Task) => void;
  onToggleTask: (task: Task) => void;
  onArchive: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onDeleteTask: (task: Task) => void;
  googleStatus: GoogleStatus | null;
  onSync: () => void;
  syncing: boolean;
}) {
  const [mode, setMode] = useState<"week" | "month" | "agenda">("week");
  const days = weekDays(new Date());
  return (
    <div className="page-stack page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">CALENDAR</p>
          <h2>把承诺放进时间，而不是留在列表里</h2>
          <p>站内日程与选中的 Google 日历保持双向同步；点击周视图空白时段可快速添加。</p>
        </div>
        <div className="intro-actions">
          <div className="segmented" role="group" aria-label="日历视图">
            {(["week", "month", "agenda"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={mode === item}
                onClick={() => setMode(item)}
              >
                {item === "week" ? "周" : item === "month" ? "月" : "议程"}
              </button>
            ))}
          </div>
          <button
            className="button button--outline"
            type="button"
            onClick={onSync}
            disabled={!googleStatus?.connected || syncing}
          >
            {syncing ? "同步中…" : "同步日历"}
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={() => onCreate()}
          >
            ＋ 新建日程
          </button>
        </div>
      </section>
      {mode === "week" ? (
        <WeekCalendar
          days={days}
          events={events}
          onCreate={onCreate}
          onEdit={onEdit}
        />
      ) : (
        <AgendaList
          events={events}
          tasks={tasks}
          projects={projects}
          onEdit={onEdit}
          onEditTask={onEditTask}
          onToggleTask={onToggleTask}
          onArchive={onArchive}
          onDelete={onDelete}
          onDeleteTask={onDeleteTask}
        />
      )}
    </div>
  );
}

function WeekCalendar({
  days,
  events,
  onCreate,
  onEdit,
}: {
  days: ReturnType<typeof weekDays>;
  events: CalendarEvent[];
  onCreate: (defaults?: EditorDraft) => void;
  onEdit: (event: CalendarEvent) => void;
}) {
  const hours = Array.from({ length: 17 }, (_, index) => index + 8);
  const now = useCurrentTime();
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasPositionedRef = useRef(false);
  const currentPosition = nowPosition(now);
  const todayIndex = days.findIndex((day) => day.isToday);

  useLayoutEffect(() => {
    const scrollArea = scrollRef.current;
    if (!scrollArea || hasPositionedRef.current) return;
    hasPositionedRef.current = true;
    const minute = Math.max(
      8 * 60,
      Math.min(24 * 60, shanghaiClockMinutes(new Date())),
    );
    const ratio = (minute - 8 * 60) / (16 * 60);
    scrollArea.scrollTop = Math.max(
      0,
      ratio * 1024 - scrollArea.clientHeight * 0.32,
    );
    if (todayIndex > 0) {
      const dayWidth = (scrollArea.scrollWidth - 76) / 7;
      scrollArea.scrollLeft = Math.max(
        0,
        76 + dayWidth * todayIndex - scrollArea.clientWidth * 0.62,
      );
    }
  }, [todayIndex]);

  function createFromDay(
    event: ReactMouseEvent<HTMLButtonElement>,
    dateKey: string,
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    const currentMinute = shanghaiClockMinutes(new Date(now));
    const requestedMinute =
      event.detail === 0
        ? dateKey === localDateKey(new Date(now))
          ? Math.ceil(currentMinute / 15) * 15
          : 9 * 60
        : 8 * 60 +
          Math.round(
            ((event.clientY - rect.top) / rect.height) * 64,
          ) *
            15;
    onCreate(eventDraft(dateKey, requestedMinute));
  }

  return (
    <section className="panel week-calendar" aria-label="本周日程">
      <div className="week-calendar-meta">
        <div>
          <strong>本周时间安排</strong>
          <span>08:00—24:00 · Asia / Shanghai</span>
        </div>
        <small>横向滑动查看本周 · 点击空白处新建日程</small>
      </div>
      <div
        ref={scrollRef}
        className="week-calendar-scroll"
        tabIndex={0}
        aria-label="本周日程时间网格，早上八点至晚上十二点"
      >
        <div className="week-calendar-canvas">
          <div className="week-calendar-header" aria-hidden="true">
            <div className="week-calendar-corner">
              <span>时间</span>
              <small>GMT+8</small>
            </div>
            {days.map((day) => (
              <div
                key={day.key}
                className={`week-day-heading ${day.isToday ? "is-today" : ""}`}
              >
                <span>{day.weekday}</span>
                <strong>{day.day}</strong>
                {day.isToday ? <small>今天</small> : null}
              </div>
            ))}
          </div>
          <div className="week-calendar-body">
            <div className="week-time-gutter" aria-hidden="true">
              {hours.map((hour) => (
                <time
                  key={hour}
                  style={
                    {
                      "--week-hour-index": hour - 8,
                    } as CSSProperties
                  }
                >
                  {String(hour).padStart(2, "0")}:00
                </time>
              ))}
            </div>
            <div className="week-day-columns">
              {days.map((day) => {
                const dayEvents = layoutCalendarDayEvents(
                  events.filter(
                    (event) =>
                      !event.allDay &&
                      localDateKey(new Date(event.startAt)) === day.key,
                  ),
                );
                return (
                  <div
                    className={`week-day-column ${day.isToday ? "is-today" : ""}`}
                    key={day.key}
                  >
                    <button
                      className="week-day-create-layer"
                      type="button"
                      aria-label={`${day.weekday} ${day.day} 日，选择时间新建日程`}
                      onClick={(event) => createFromDay(event, day.key)}
                    />
                    {day.isToday && currentPosition ? (
                      <div
                        className="week-now-marker"
                        style={
                          {
                            "--now-position": currentPosition,
                          } as CSSProperties
                        }
                        aria-hidden="true"
                      />
                    ) : null}
                    {dayEvents.map(({ event, lane, laneCount }) => {
                      const geometry = eventGeometry(event);
                      return (
                        <button
                          type="button"
                          key={event.id}
                          className="week-calendar-event"
                          style={
                            {
                              "--event-top": geometry.top,
                              "--event-height": geometry.height,
                              "--event-color": event.color,
                              "--event-lane": lane,
                              "--event-lanes": laneCount,
                            } as CSSProperties
                          }
                          aria-label={`编辑日程 ${event.title}，${formatTime(event.startAt)} 至 ${formatTime(event.endAt)}`}
                          onClick={() => onEdit(event)}
                        >
                          <time>
                            {formatTime(event.startAt)}—{formatTime(event.endAt)}
                          </time>
                          <strong>{event.title}</strong>
                          <span>
                            {event.source === "google"
                              ? "Google Calendar"
                              : "站内日程"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AgendaList({
  events,
  tasks,
  projects,
  onEdit,
  onEditTask,
  onToggleTask,
  onArchive,
  onDelete,
  onDeleteTask,
}: {
  events: CalendarEvent[];
  tasks: Task[];
  projects: Project[];
  onEdit: (event: CalendarEvent) => void;
  onEditTask: (task: Task) => void;
  onToggleTask: (task: Task) => void;
  onArchive: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onDeleteTask: (task: Task) => void;
}) {
  const now = useCurrentTime();
  const todayKey = localDateKey(new Date(now));
  const pendingTasks = tasks
    .filter((task) => task.status !== "done" && task.dueDate)
    .sort((left, right) =>
      (left.dueDate ?? "").localeCompare(right.dueDate ?? ""),
    );
  const upcomingEvents = events.filter(
    (event) => new Date(event.endAt).getTime() >= now,
  );
  const projectNames = new Map(
    projects.map((project) => [project.id, project.title]),
  );
  const agendaCount = pendingTasks.length + upcomingEvents.length;

  return (
    <section className="panel agenda-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">AGENDA</p>
          <h2>接下来要处理的事</h2>
        </div>
        <span>{agendaCount} 项</span>
      </div>
      <p className="agenda-description">
        这里只汇总未完成且设有 DDL 的任务，以及尚未结束的未来日程；普通时间记录仍留在周视图中。
      </p>
      <div className="agenda-groups">
        <section className="agenda-group" aria-labelledby="agenda-task-heading">
          <div className="agenda-group-heading">
            <div>
              <span className="agenda-kind agenda-kind--task">TASK</span>
              <h3 id="agenda-task-heading">待完成任务</h3>
            </div>
            <span>{pendingTasks.length} 项</span>
          </div>
          {pendingTasks.length ? (
            <div className="agenda-list">
              {pendingTasks.map((task) => {
                const overdue = (task.dueDate ?? "") < todayKey;
                return (
                  <article
                    key={task.id}
                    className={`agenda-row agenda-row--task ${overdue ? "is-overdue" : ""}`}
                  >
                    <time dateTime={task.dueDate ?? undefined}>
                      <strong>{formatShortDate(task.dueDate ?? "")}</strong>
                      <span>{overdue ? "已逾期" : "截止"}</span>
                    </time>
                    <input
                      className="agenda-check"
                      type="checkbox"
                      aria-label={`完成任务 ${task.title}`}
                      checked={false}
                      onChange={() => onToggleTask(task)}
                    />
                    <button
                      id={`agenda-task-${task.id}`}
                      className="agenda-open"
                      type="button"
                      onClick={() => onEditTask(task)}
                    >
                      <strong>{task.title}</strong>
                      <span>
                        {task.projectId
                          ? projectNames.get(task.projectId) ?? "项目子目标"
                          : "独立任务"}
                      </span>
                    </button>
                    <div className="row-actions">
                      <button
                        className="row-action row-action--delete"
                        type="button"
                        aria-label={`删除任务 ${task.title}`}
                        title="删除"
                        onClick={() => onDeleteTask(task)}
                      >
                        ×
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="agenda-empty">没有未完成且设有 DDL 的任务。</p>
          )}
        </section>

        <section className="agenda-group" aria-labelledby="agenda-event-heading">
          <div className="agenda-group-heading">
            <div>
              <span className="agenda-kind agenda-kind--event">CALENDAR</span>
              <h3 id="agenda-event-heading">未来日程</h3>
            </div>
            <span>{upcomingEvents.length} 项</span>
          </div>
          {upcomingEvents.length ? (
            <div className="agenda-list">
              {upcomingEvents.map((event) => (
            <article key={event.id} className="agenda-row">
              <time dateTime={event.startAt}>
                <strong>{formatMonthDay(event.startAt)}</strong>
                <strong>{formatTime(event.startAt)}</strong>
              </time>
              <span
                className="agenda-dot"
                style={{ background: event.color }}
              />
              <button
                className="agenda-open"
                type="button"
                onClick={() => onEdit(event)}
              >
                <strong>{event.title}</strong>
                <span>
                  {event.source === "google" ? "Google Calendar" : "站内日程"}
                </span>
              </button>
              <div className="row-actions">
                <button
                  className="row-action"
                  type="button"
                  onClick={() => onArchive(event)}
                >
                  归档
                </button>
                <button
                  className="row-action row-action--delete"
                  type="button"
                  aria-label={`删除日程 ${event.title}`}
                  title="删除"
                  onClick={() => onDelete(event)}
                >
                  ×
                </button>
              </div>
            </article>
              ))}
            </div>
          ) : (
            <p className="agenda-empty">目前没有尚未结束的未来日程。</p>
          )}
        </section>
      </div>
    </section>
  );
}

function ProjectsView({
  projects,
  tasks,
  onCreate,
  onEdit,
  onCreateSubgoal,
  onUpdate,
  onArchive,
  onDelete,
  onDeleteTask,
}: {
  projects: Project[];
  tasks: Task[];
  onCreate: () => void;
  onEdit: (project: Project) => void;
  onCreateSubgoal: (projectId: string) => void;
  onUpdate: (
    entity: EntityName,
    id: string,
    data: Record<string, unknown>,
    message?: string,
  ) => void;
  onArchive: (project: Project) => void;
  onDelete: (project: Project) => void;
  onDeleteTask: (task: Task) => void;
}) {
  return (
    <div className="page-stack page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">PROJECTS</p>
          <h2>把大型工程拆成可以完成的子目标</h2>
          <p>项目只在这里创建；普通日程和今日任务不会自动成为项目。</p>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={onCreate}
        >
          ＋ 新建项目
        </button>
      </section>
      <div className="project-overview">
        {projects.length ? projects.map((project) => {
          const subgoals = tasks.filter(
            (task) => task.projectId === project.id,
          );
          const completed = subgoals.filter(
            (task) => task.status === "done",
          ).length;
          return (
          <article
            className="panel project-card"
            key={project.id}
            style={{ "--project-color": project.color } as CSSProperties}
          >
            <button
              id={`project-edit-${project.id}`}
              className="project-card-edit-target"
              type="button"
              aria-label={`编辑项目 ${project.title}`}
              onClick={() => onEdit(project)}
            />
            <div className="project-card-head">
              <span className="project-code">
                P-{project.id.slice(-2).toUpperCase()}
              </span>
              <div className="row-actions">
                <button
                  className="row-action"
                  type="button"
                  onClick={() => onArchive(project)}
                >
                  归档
                </button>
                <button
                  className="row-action row-action--delete"
                  type="button"
                  aria-label={`删除项目 ${project.title}`}
                  title="删除"
                  onClick={() => onDelete(project)}
                >
                  ×
                </button>
              </div>
            </div>
            <h3>{project.title}</h3>
            <p>{project.description}</p>
            <div className="project-subgoal-heading">
              <div>
                <span>子目标</span>
                <strong>
                  {completed}/{subgoals.length} 已完成
                </strong>
              </div>
              <button
                className="text-button"
                type="button"
                onClick={() => onCreateSubgoal(project.id)}
              >
                ＋ 添加子目标
              </button>
            </div>
            <div className="project-subgoal-list">
              {subgoals.length ? (
                subgoals.map((task) => (
                  <div className="project-subgoal-row" key={task.id}>
                    <span className={task.status === "done" ? "is-done" : ""}>
                      {task.title}
                    </span>
                    {task.dueDate ? <time>{formatShortDate(task.dueDate)}</time> : null}
                    <button
                      className="row-action row-action--delete"
                      type="button"
                      aria-label={`删除子目标 ${task.title}`}
                      title="删除"
                      onClick={() => onDeleteTask(task)}
                    >
                      ×
                    </button>
                    <div
                      className="project-subgoal-status"
                      role="group"
                      aria-label={`设置子目标「${task.title}」的状态`}
                    >
                      {subgoalStatuses.map((status) => (
                        <button
                          key={status.value}
                          className={`project-subgoal-status-button is-${status.value}`}
                          type="button"
                          aria-pressed={task.status === status.value}
                          onClick={() =>
                            onUpdate(
                              "task",
                              task.id,
                              { status: status.value },
                              `子目标已设为${status.label}`,
                            )
                          }
                        >
                          {status.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="project-subgoal-empty">
                  <span aria-hidden="true">○</span>
                  <p>还没有子目标。先拆出第一个可验证的结果。</p>
                </div>
              )}
            </div>
            <footer className="project-card-footer">
              <span>
                {project.deadline
                  ? `截止 ${formatShortDate(project.deadline)}`
                  : "未设置截止日期"}
              </span>
              <button
                className="button button--outline"
                type="button"
                onClick={() => onCreateSubgoal(project.id)}
              >
                创建子目标
              </button>
            </footer>
          </article>
          );
        }) : (
          <section className="panel project-empty-state">
            <EmptyState
              title="还没有项目"
              description="项目用于需要多个阶段或多个交付结果的大型工程。"
              action="创建第一个项目"
              onAction={onCreate}
            />
          </section>
        )}
      </div>
    </div>
  );
}

function LearningView({
  domains,
  logs,
  notes,
  onCreateDomain,
  onEditDomain,
  onCreateLog,
  onCreateNote,
  onEditNote,
  onUpdate,
}: {
  domains: Domain[];
  logs: LearningLog[];
  notes: KnowledgeNote[];
  onCreateDomain: () => void;
  onEditDomain: (domain: Domain) => void;
  onCreateLog: () => void;
  onCreateNote: (defaults: EditorDraft) => void;
  onEditNote: (note: KnowledgeNote) => void;
  onUpdate: (
    entity: EntityName,
    id: string,
    data: Record<string, unknown>,
    message?: string,
  ) => void;
}) {
  const [selectedId, setSelectedId] = useState(domains[0]?.id ?? "");
  const [noteScope, setNoteScope] = useState<"domain" | "cross">("domain");
  const selected =
    domains.find((domain) => domain.id === selectedId) ?? domains[0];
  const selectedNotes = selected
    ? notes.filter((note) => note.domainId === selected.id)
    : [];
  const insights = selectedNotes.filter((note) => note.kind === "insight");
  const branches = selectedNotes.filter((note) => note.kind === "branch");
  const stageSummaries = selectedNotes.filter((note) => note.kind === "stage");
  const domainNotes = selectedNotes.filter((note) => note.kind === "note");
  const crossDomainNotes = notes.filter(
    (note) => note.kind === "note" && !note.domainId,
  );
  const visibleNotes = noteScope === "domain" ? domainNotes : crossDomainNotes;

  function createKnowledgeNote(
    kind: KnowledgeNote["kind"],
    domainId = selected?.id ?? "",
  ) {
    onCreateNote({
      kind,
      domainId,
      stage: String(selected?.stage ?? 1),
    });
  }

  return (
    <div className="page-stack page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">LEARNING DOMAINS</p>
          <h2>把学习压缩成可回顾的认知档案</h2>
          <p>按领域整理核心认知、知识分支与阶段总结，也保留跨领域连接。</p>
        </div>
        <div className="intro-actions">
          <button
            className="button button--outline"
            type="button"
            onClick={onCreateLog}
          >
            记录学习
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={onCreateDomain}
          >
            ＋ 新建领域
          </button>
        </div>
      </section>

      {domains.length ? (
        <section className="domain-library" aria-labelledby="domain-library-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DOMAIN LIBRARY</p>
              <h2 id="domain-library-title">领域书架</h2>
            </div>
            <span>{domains.length} 个领域</span>
          </div>
          <div
            className="domain-shelf"
            role="region"
            aria-label={`领域书架，共 ${domains.length} 个领域，可横向滚动`}
            tabIndex={0}
          >
            {domains.map((domain) => {
              const domainKnowledge = notes.filter(
                (note) => note.domainId === domain.id && note.kind !== "note",
              ).length;
              return (
                <button
                  id={`domain-select-${domain.id}`}
                  className={`domain-shelf-card ${selected?.id === domain.id ? "is-selected" : ""}`}
                  type="button"
                  key={domain.id}
                  aria-pressed={selected?.id === domain.id}
                  style={{ "--domain-color": domain.color } as CSSProperties}
                  onClick={() => setSelectedId(domain.id)}
                >
                  <div className="domain-card-meta">
                    <span className="domain-card-stage">
                      阶段 {domain.stage} · {stageLabels[domain.stage - 1]}
                    </span>
                    <span className="domain-card-status">
                      {domain.stage >= 5 ? "已完成" : "学习中"}
                    </span>
                  </div>
                  <strong>{domain.title}</strong>
                  <p>{domain.summary || "还没有写下这一领域的核心理解。"}</p>
                  <small>{domainKnowledge} 条认知记录</small>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="panel learning-empty-state">
          <EmptyState
            title="还没有学习领域"
            description="创建一个领域，开始沉淀自己的认知框架。"
            action="新建领域"
            onAction={onCreateDomain}
          />
        </section>
      )}

      {selected ? (
        <div className="learning-workbench">
          <section className="panel knowledge-record" aria-labelledby="knowledge-record-title">
            <header className="knowledge-record-header">
              <div>
                <p className="eyebrow">COGNITIVE RECORD</p>
                <h2 id="knowledge-record-title">{selected.title}</h2>
                <span>
                  阶段 {String(selected.stage).padStart(2, "0")} / 05 ·{" "}
                  {stageLabels[selected.stage - 1]} · {selected.stage >= 5 ? "已完成" : "学习中"}
                </span>
              </div>
              <button
                className="button button--outline"
                type="button"
                onClick={() => onEditDomain(selected)}
              >
                编辑领域
              </button>
            </header>

            <div className="cognition-summary">
              <span>当前理解</span>
              <p>{selected.summary || "用一两句话写下你目前对这个领域最重要的理解。"}</p>
            </div>

            <section className="knowledge-section">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="eyebrow">KEY INSIGHTS</p>
                  <h3>核心认知</h3>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => createKnowledgeNote("insight")}
                >
                  ＋ 记录认知
                </button>
              </div>
              {insights.length ? (
                <div className="insight-grid">
                  {insights.map((note, index) => (
                    <KnowledgeNoteCard
                      key={note.id}
                      note={note}
                      index={index}
                      onEdit={onEditNote}
                    />
                  ))}
                </div>
              ) : (
                <KnowledgeEmpty
                  text="把最能改变你思考方式的结论写在这里。"
                  action="记录第一条认知"
                  onAction={() => createKnowledgeNote("insight")}
                />
              )}
            </section>

            <section className="knowledge-section">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="eyebrow">KNOWLEDGE BRANCHES</p>
                  <h3>知识分支</h3>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => createKnowledgeNote("branch")}
                >
                  ＋ 新增分支
                </button>
              </div>
              {branches.length ? (
                <div className="branch-grid">
                  {branches.map((note, index) => (
                    <KnowledgeNoteCard
                      key={note.id}
                      note={note}
                      index={index}
                      onEdit={onEditNote}
                    />
                  ))}
                </div>
              ) : (
                <KnowledgeEmpty
                  text="用高度凝练的分支整理这个领域的组成部分。"
                  action="添加第一个分支"
                  onAction={() => createKnowledgeNote("branch")}
                />
              )}
            </section>

            <section className="knowledge-section">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="eyebrow">STAGE NOTES</p>
                  <h3>分阶段总结</h3>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => createKnowledgeNote("stage")}
                >
                  ＋ 写阶段总结
                </button>
              </div>
              <div className="stage-timeline">
                {stageLabels.map((label, index) => {
                  const stage = index + 1;
                  const stageNotes = stageSummaries.filter(
                    (note) => note.stage === stage,
                  );
                  return (
                    <div
                      className={`stage-timeline-row ${stage < selected.stage ? "is-complete" : stage === selected.stage ? "is-current" : ""}`}
                      key={label}
                    >
                      <span className="stage-index">{String(stage).padStart(2, "0")}</span>
                      <div>
                        <strong>{label}</strong>
                        {stageNotes.length ? (
                          stageNotes.map((note) => (
                            <button
                              id={`knowledge-note-${note.id}`}
                              className="stage-note-link"
                              type="button"
                              key={note.id}
                              onClick={() => onEditNote(note)}
                            >
                              <span>{note.title}</span>
                              <small>{note.content || "打开补充这一阶段的总结"}</small>
                            </button>
                          ))
                        ) : (
                          <small>{stage <= selected.stage ? "尚未写总结" : "尚未到达"}</small>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </section>

          <aside className="learning-sidebar">
            <section className="panel learning-progress-card">
              <p className="eyebrow">LEARNING POSITION</p>
              <div className="stage-label">
                <span>当前阶段</span>
                <strong>{selected.stage} / 5</strong>
              </div>
              <StageMeter stage={selected.stage} />
              <div className="next-step-block">
                <span>下一步</span>
                <p>{selected.nextStep || "确定下一步具体的学习行动。"}</p>
              </div>
              <div className="stage-controls stage-controls--wide">
                <button
                  type="button"
                  disabled={selected.stage <= 1}
                  onClick={() =>
                    onUpdate(
                      "domain",
                      selected.id,
                      { stage: selected.stage - 1 },
                      "学习阶段已更新",
                    )
                  }
                >
                  上一阶段
                </button>
                <button
                  type="button"
                  disabled={selected.stage >= 5}
                  onClick={() =>
                    onUpdate(
                      "domain",
                      selected.id,
                      { stage: selected.stage + 1 },
                      "学习阶段已更新",
                    )
                  }
                >
                  推进阶段
                </button>
              </div>
            </section>

            <section className="panel knowledge-notebook">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="eyebrow">NOTEBOOK</p>
                  <h3>笔记</h3>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    createKnowledgeNote(
                      "note",
                      noteScope === "domain" ? selected.id : "",
                    )
                  }
                >
                  ＋ 新建
                </button>
              </div>
              <div className="segmented notebook-tabs" role="group" aria-label="笔记范围">
                <button
                  type="button"
                  aria-pressed={noteScope === "domain"}
                  onClick={() => setNoteScope("domain")}
                >
                  领域内
                </button>
                <button
                  type="button"
                  aria-pressed={noteScope === "cross"}
                  onClick={() => setNoteScope("cross")}
                >
                  跨领域
                </button>
              </div>
              <div className="notebook-list">
                {visibleNotes.length ? (
                  visibleNotes.map((note) => (
                    <KnowledgeNoteCard
                      key={note.id}
                      note={note}
                      onEdit={onEditNote}
                    />
                  ))
                ) : (
                  <KnowledgeEmpty
                    text={
                      noteScope === "domain"
                        ? "保存与当前领域有关、但还不属于认知骨架的笔记。"
                        : "把跨越多个领域的连接与启发集中放在这里。"
                    }
                    action={noteScope === "domain" ? "写领域笔记" : "写跨领域笔记"}
                    onAction={() =>
                      createKnowledgeNote(
                        "note",
                        noteScope === "domain" ? selected.id : "",
                      )
                    }
                  />
                )}
              </div>
            </section>
          </aside>
        </div>
      ) : null}

      <section className="panel log-panel learning-log-panel">
        <div className="panel-heading">
          <h2>最近学习记录</h2>
          <span>{logs.length} 条</span>
        </div>
        {logs.length ? (
          logs.map((log) => (
            <article className="log-row" key={log.id}>
              <time>{formatMonthDay(log.occurredAt)}</time>
              <div>
                <strong>{log.title}</strong>
                <p>
                  {log.note ||
                    domains.find((domain) => domain.id === log.domainId)?.title}
                </p>
              </div>
              <span>{log.minutes} 分钟</span>
            </article>
          ))
        ) : (
          <EmptyState
            title="还没有学习记录"
            description="完成一次学习后，记录你理解发生了什么变化。"
            action="记录学习"
            onAction={onCreateLog}
          />
        )}
      </section>
    </div>
  );
}

function KnowledgeNoteCard({
  note,
  index,
  onEdit,
}: {
  note: KnowledgeNote;
  index?: number;
  onEdit: (note: KnowledgeNote) => void;
}) {
  return (
    <button
      id={`knowledge-note-${note.id}`}
      className={`knowledge-note-card knowledge-note-card--${note.kind}`}
      type="button"
      onClick={() => onEdit(note)}
    >
      {index !== undefined ? (
        <span className="knowledge-note-index">{String(index + 1).padStart(2, "0")}</span>
      ) : null}
      <strong>{note.title}</strong>
      <p>{note.content || "打开补充内容"}</p>
      <small>{knowledgeNoteKindLabel(note.kind)}</small>
    </button>
  );
}

function KnowledgeEmpty({
  text,
  action,
  onAction,
}: {
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="knowledge-empty">
      <p>{text}</p>
      <button className="text-button" type="button" onClick={onAction}>
        {action}
      </button>
    </div>
  );
}

function IdeasView({
  ideas,
  projects,
  domains,
  onCreate,
  onEdit,
  onUpdate,
  onArchive,
}: {
  ideas: Idea[];
  projects: Project[];
  domains: Domain[];
  onCreate: () => void;
  onEdit: (idea: Idea) => void;
  onUpdate: (
    entity: EntityName,
    id: string,
    data: Record<string, unknown>,
    message?: string,
  ) => void;
  onArchive: (idea: Idea) => void;
}) {
  const [filter, setFilter] = useState<"all" | "idea" | "question">("all");
  const filtered = ideas.filter(
    (idea) => filter === "all" || idea.type === filter,
  );
  return (
    <div className="page-stack page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">IDEAS & QUESTIONS</p>
          <h2>先捕捉，再决定它应该去哪里</h2>
          <p>把模糊想法变成问题、探索或下一步行动。</p>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={onCreate}
        >
          ＋ 捕捉新线索
        </button>
      </section>
      <div className="filter-bar">
        <div className="segmented" role="group" aria-label="内容类型">
          {(["all", "idea", "question"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
            >
              {item === "all" ? "全部" : item === "idea" ? "Ideas" : "疑问"}
            </button>
          ))}
        </div>
        <span>{filtered.length} 条线索</span>
      </div>
      <div className="idea-grid">
        {filtered.map((idea) => (
          <article className="panel idea-card" key={idea.id}>
            <button
              id={`idea-edit-${idea.id}`}
              className="idea-card-edit-target"
              type="button"
              aria-label={`编辑${idea.type === "question" ? "疑问" : "Idea"} ${idea.title}`}
              onClick={() => onEdit(idea)}
            />
            <div className="idea-card-head">
              <span className={`type-badge type-badge--${idea.type}`}>
                {idea.type === "question" ? "疑问" : "Idea"}
              </span>
              <button
                className="icon-button"
                type="button"
                aria-label={`归档 ${idea.title}`}
                onClick={() => onArchive(idea)}
              >
                ···
              </button>
            </div>
            <h3>{idea.title}</h3>
            <p>{idea.note || "还没有补充笔记。"}</p>
            <div className="relation-line">
              <span>
                {domains.find((domain) => domain.id === idea.domainId)?.title ??
                  "未关联领域"}
              </span>
              <span>
                {projects.find((project) => project.id === idea.projectId)
                  ?.title ?? "未关联项目"}
              </span>
            </div>
            <div className="status-actions">
              <button
                type="button"
                aria-pressed={idea.status === "exploring"}
                onClick={() =>
                  onUpdate(
                    "idea",
                    idea.id,
                    { status: "exploring" },
                    "已标记为探索中",
                  )
                }
              >
                探索中
              </button>
              <button
                type="button"
                aria-pressed={idea.status === "resolved"}
                onClick={() =>
                  onUpdate(
                    "idea",
                    idea.id,
                    { status: "resolved" },
                    "已标记为解决",
                  )
                }
              >
                已解决
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ReviewView({ snapshot }: { snapshot: Snapshot }) {
  const completed = snapshot.tasks.filter(
    (task) => task.status === "done",
  ).length;
  const total = snapshot.tasks.length || 1;
  const minutes = snapshot.learningLogs.reduce(
    (sum, log) => sum + log.minutes,
    0,
  );
  const resolved = snapshot.ideas.filter(
    (idea) => idea.status === "resolved",
  ).length;
  const nextProjectGoal = snapshot.tasks.find(
    (task) => task.projectId && task.status !== "done",
  );
  return (
    <div className="page-stack page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">WEEKLY REVIEW</p>
          <h2>回顾不是打分，而是决定下周保留什么</h2>
          <p>聚合时间投入、项目推进和理解变化，帮助你调整下一步。</p>
        </div>
        <button
          className="button button--outline"
          type="button"
          onClick={() => window.print()}
        >
          打印本周回顾
        </button>
      </section>
      <div className="review-stats">
        <article>
          <span>任务完成</span>
          <strong>
            {completed}/{total}
          </strong>
          <small>{Math.round((completed / total) * 100)}%</small>
        </article>
        <article>
          <span>学习投入</span>
          <strong>{minutes}</strong>
          <small>分钟</small>
        </article>
        <article>
          <span>已解决问题</span>
          <strong>{resolved}</strong>
          <small>条</small>
        </article>
      </div>
      <section className="panel review-chart">
        <div className="panel-heading">
          <h2>本周时间投入</h2>
          <span>按工作类型</span>
        </div>
        <div
          className="allocation-chart"
          role="img"
          aria-label="本周时间投入：项目 55%，领域学习 30%，日常安排 15%"
        >
          <div>
            <span>项目推进</span>
            <i style={{ width: "55%" }} />
            <strong>55%</strong>
          </div>
          <div>
            <span>领域学习</span>
            <i style={{ width: "30%" }} />
            <strong>30%</strong>
          </div>
          <div>
            <span>日常安排</span>
            <i style={{ width: "15%" }} />
            <strong>15%</strong>
          </div>
        </div>
      </section>
      <section className="review-grid">
        <article className="panel">
          <p className="eyebrow">KEEP</p>
          <h3>下周继续保持</h3>
          <p>上午保留一段不被会议切开的深度工作时间。</p>
        </article>
        <article className="panel">
          <p className="eyebrow">ADJUST</p>
          <h3>需要调整</h3>
          <p>把“阅读资料”改写成可验证的理解目标或具体问题。</p>
        </article>
        <article className="panel">
          <p className="eyebrow">NEXT</p>
          <h3>最重要的下一步</h3>
          <p>
            {nextProjectGoal?.title || "为最重要的项目创建一个子目标。"}
          </p>
        </article>
      </section>
    </div>
  );
}

function SettingsView({
  viewer,
  googleStatus,
  setGoogleStatus,
  onRefresh,
  onSync,
  syncing,
  notify,
}: {
  viewer: Viewer;
  googleStatus: GoogleStatus | null;
  setGoogleStatus: (status: GoogleStatus | null) => void;
  onRefresh: () => Promise<void>;
  onSync: () => void;
  syncing: boolean;
  notify: (message: string, tone?: Toast["tone"]) => void;
}) {
  const [updating, setUpdating] = useState("");
  async function toggleCalendar(calendar: GoogleCalendar) {
    setUpdating(calendar.id);
    try {
      const response = await fetch("/api/google/calendars", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          calendarId: calendar.calendarId,
          selected: !calendar.selected,
        }),
      });
      if (!response.ok) throw new Error();
      setGoogleStatus(
        googleStatus
          ? {
              ...googleStatus,
              calendars: googleStatus.calendars.map((item) =>
                item.id === calendar.id
                  ? { ...item, selected: !item.selected }
                  : item,
              ),
            }
          : null,
      );
      notify("同步范围已更新");
    } catch {
      notify("同步范围未更新", "error");
    } finally {
      setUpdating("");
    }
  }
  async function disconnect() {
    setUpdating("disconnect");
    try {
      const response = await fetch("/api/google/disconnect", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      await onRefresh();
      notify("Google Calendar 已断开", "warning");
    } catch {
      notify("未能断开连接", "error");
    } finally {
      setUpdating("");
    }
  }
  return (
    <div className="settings-layout page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">SETTINGS</p>
          <h2>连接与隐私</h2>
          <p>管理私人访问、Google Calendar 同步范围和数据状态。</p>
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="settings-heading">
          <div>
            <span className="settings-icon" aria-hidden="true">
              G
            </span>
            <div>
              <h3>Google Calendar</h3>
              <p>
                {googleStatus?.connected
                  ? `已连接 ${googleStatus.googleEmail}`
                  : "连接后可双向同步选中的日历。"}
              </p>
            </div>
          </div>
          <span
            className={`connection-status ${googleStatus?.connected ? "is-connected" : ""}`}
          >
            {googleStatus?.connected
              ? "已连接"
              : googleStatus?.configured
                ? "未连接"
                : "待配置"}
          </span>
        </div>
        {googleStatus?.connected ? (
          <>
            <div className="calendar-list">
              <h4>同步这些日历</h4>
              {googleStatus.calendars.map((calendar) => (
                <label className="calendar-option" key={calendar.id}>
                  <input
                    type="checkbox"
                    checked={calendar.selected}
                    disabled={updating === calendar.id}
                    onChange={() => toggleCalendar(calendar)}
                  />
                  <span
                    className="calendar-swatch"
                    style={{ background: calendar.color }}
                  />
                  <span>
                    <strong>{calendar.name}</strong>
                    <small>
                      {calendar.isPrimary
                        ? "主日历"
                        : calendar.writable
                          ? "可写入"
                          : "只读"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <div className="settings-actions">
              <button
                className="button button--primary"
                type="button"
                disabled={syncing}
                onClick={onSync}
              >
                {syncing ? "同步中…" : "立即同步"}
              </button>
              <button
                className="button button--ghost-danger"
                type="button"
                disabled={updating === "disconnect"}
                onClick={disconnect}
              >
                断开连接
              </button>
              <span>
                {googleStatus.lastSyncAt
                  ? `上次同步 ${formatRelative(googleStatus.lastSyncAt)}`
                  : "尚未同步"}
              </span>
            </div>
          </>
        ) : (
          <div className="settings-connect">
            <p>
              {googleStatus?.configured
                ? "授权时只请求日历和邮箱信息；授权令牌只保存在服务端。"
                : "发布后需要先配置 Google OAuth 客户端和加密密钥。"}
            </p>
            {googleStatus?.configured ? (
              <a className="button button--primary" href="/api/google/connect">
                连接 Google Calendar
              </a>
            ) : (
              <button className="button button--outline" type="button" disabled>
                等待 OAuth 配置
              </button>
            )}
          </div>
        )}
      </section>
      <section className="panel settings-panel">
        <div className="settings-heading">
          <div>
            <span className="settings-icon" aria-hidden="true">
              私
            </span>
            <div>
              <h3>私人访问</h3>
              <p>{viewer.email}</p>
            </div>
          </div>
          <span className="connection-status is-connected">仅自己</span>
        </div>
        <p className="settings-copy">
          所有页面和数据接口都会在服务端验证登录账号。其他账号即使拥有网址，也无法读取工作台内容。
        </p>
      </section>
      <section className="panel settings-panel">
        <div className="settings-heading">
          <div>
            <span className="settings-icon" aria-hidden="true">
              数
            </span>
            <div>
              <h3>数据与时区</h3>
              <p>Sites D1 · Asia/Shanghai · 公历</p>
            </div>
          </div>
        </div>
        <p className="settings-copy">
          任务、项目、学习进度和 Ideas
          保存在云端数据库。浏览器只保存设备级显示偏好。
        </p>
      </section>
    </div>
  );
}

function EditorDialog({
  entity,
  draft,
  setDraft,
  error,
  saving,
  editing,
  suspended,
  snapshot,
  onClose,
  onSubmit,
  onDelete,
}: {
  entity: EntityName;
  draft: EditorDraft;
  setDraft: (draft: EditorDraft) => void;
  error: string;
  saving: boolean;
  editing: boolean;
  suspended: boolean;
  snapshot: Snapshot | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete?: () => void;
}) {
  const titleRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, titleRef, onClose, !suspended);
  const label =
    entity === "task" && draft.projectId ? "子目标" : entityLabel(entity);

  useEffect(() => {
    if (!(titleRef.current instanceof HTMLTextAreaElement)) return;
    titleRef.current.style.height = "auto";
    titleRef.current.style.height = `${Math.min(titleRef.current.scrollHeight, 144)}px`;
  }, [draft.title, entity]);

  const titleFieldProps = {
    id: "editor-title",
    value: draft.title ?? "",
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setDraft({ ...draft, title: event.target.value }),
    "aria-invalid": Boolean(error && !draft.title?.trim()),
    "aria-describedby": error ? "editor-error" : undefined,
    placeholder:
      entity === "idea" ? "记录一个想法或疑问…" : `填写${label}标题…`,
  };
  return (
    <div
      className="modal-backdrop"
      aria-hidden={suspended || undefined}
      inert={suspended || undefined}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !saving) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-dialog-title"
      >
        <header>
          <div>
            <p className="eyebrow">QUICK CAPTURE</p>
            <h2 id="editor-dialog-title">
              {editing ? `编辑${label}` : `创建${label}`}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="关闭编辑器"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </header>
        <form noValidate onSubmit={onSubmit}>
          <div className="field-group">
            <label htmlFor="editor-title">标题</label>
            {entity === "idea" ? (
              <textarea
                {...titleFieldProps}
                ref={(node) => {
                  titleRef.current = node;
                }}
                className="editor-title-textarea resize-none"
                rows={2}
              />
            ) : (
              <input
                {...titleFieldProps}
                ref={(node) => {
                  titleRef.current = node;
                }}
              />
            )}
          </div>
          {entity === "idea" ? (
            <div
              className="segmented field-segment"
              role="group"
              aria-label="记录类型"
            >
              <button
                type="button"
                aria-pressed={draft.type !== "question"}
                onClick={() => setDraft({ ...draft, type: "idea" })}
              >
                Idea
              </button>
              <button
                type="button"
                aria-pressed={draft.type === "question"}
                onClick={() => setDraft({ ...draft, type: "question" })}
              >
                疑问
              </button>
            </div>
          ) : null}
          {entity === "idea" ? (
            <div className="field-row field-row--two">
              <div className="field-group">
                <label htmlFor="idea-domain">关联领域</label>
                <select
                  id="idea-domain"
                  value={draft.domainId ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, domainId: event.target.value })
                  }
                >
                  <option value="">未关联领域</option>
                  {snapshot?.domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label htmlFor="idea-project">关联项目</label>
                <select
                  id="idea-project"
                  value={draft.projectId ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, projectId: event.target.value })
                  }
                >
                  <option value="">未关联项目</option>
                  {snapshot?.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
          {entity === "event" ? (
            <>
              <div className="field-row">
                <TypedField
                  id="event-date"
                  label="日期"
                  hint="YYYY-MM-DD"
                  value={draft.date ?? ""}
                  onChange={(value) => setDraft({ ...draft, date: value })}
                />
                <TypedField
                  id="event-start"
                  label="开始"
                  hint="HH:mm"
                  value={draft.start ?? ""}
                  onChange={(value) => setDraft({ ...draft, start: value })}
                />
                <TypedField
                  id="event-end"
                  label="结束"
                  hint="HH:mm"
                  value={draft.end ?? ""}
                  onChange={(value) => setDraft({ ...draft, end: value })}
                />
              </div>
            </>
          ) : null}
          {entity === "project" ? (
            <TypedField
              id="project-deadline"
              label="截止日期"
              hint="YYYY-MM-DD，可选"
              value={draft.deadline ?? ""}
              onChange={(value) => setDraft({ ...draft, deadline: value })}
            />
          ) : null}
          {entity === "domain" ? (
            <div className="field-group">
              <label htmlFor="domain-stage">理解阶段</label>
              <select
                id="domain-stage"
                value={draft.stage ?? "1"}
                onChange={(event) =>
                  setDraft({ ...draft, stage: event.target.value })
                }
              >
                {stageLabels.map((item, index) => (
                  <option key={item} value={index + 1}>
                    {index + 1} · {item}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {entity === "knowledgeNote" ? (
            <>
              <div className="field-row field-row--two">
                <div className="field-group">
                  <label htmlFor="knowledge-kind">条目类型</label>
                  <select
                    id="knowledge-kind"
                    value={draft.kind ?? "insight"}
                    onChange={(event) =>
                      setDraft({ ...draft, kind: event.target.value })
                    }
                  >
                    <option value="insight">核心认知</option>
                    <option value="branch">知识分支</option>
                    <option value="stage">阶段总结</option>
                    <option value="note">普通笔记</option>
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="knowledge-domain">所属领域</label>
                  <select
                    id="knowledge-domain"
                    value={draft.domainId ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, domainId: event.target.value })
                    }
                  >
                    <option value="">
                      {draft.kind === "note" ? "跨领域" : "选择领域"}
                    </option>
                    {snapshot?.domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>
                        {domain.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {draft.kind === "stage" ? (
                <div className="field-group">
                  <label htmlFor="knowledge-stage">对应阶段</label>
                  <select
                    id="knowledge-stage"
                    value={draft.stage ?? "1"}
                    onChange={(event) =>
                      setDraft({ ...draft, stage: event.target.value })
                    }
                  >
                    {stageLabels.map((item, index) => (
                      <option key={item} value={index + 1}>
                        {index + 1} · {item}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </>
          ) : null}
          {entity === "learningLog" ? (
            <>
              <div className="field-group">
                <label htmlFor="log-domain">学习领域</label>
                <select
                  id="log-domain"
                  value={draft.domainId ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, domainId: event.target.value })
                  }
                >
                  <option value="">选择领域</option>
                  {snapshot?.domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <TypedField
                  id="log-date"
                  label="日期"
                  hint="YYYY-MM-DD"
                  value={draft.occurredDate ?? ""}
                  onChange={(value) =>
                    setDraft({ ...draft, occurredDate: value })
                  }
                />
                <TypedField
                  id="log-minutes"
                  label="投入时间"
                  hint="分钟"
                  value={draft.minutes ?? "45"}
                  onChange={(value) => setDraft({ ...draft, minutes: value })}
                />
              </div>
            </>
          ) : null}
          {entity === "task" ? (
            <>
              {draft.projectId ? (
                <div className="editor-context" role="status">
                  <span>所属项目</span>
                  <strong>
                    {snapshot?.projects.find(
                      (project) => project.id === draft.projectId,
                    )?.title ?? "当前项目"}
                  </strong>
                </div>
              ) : null}
              <TypedField
                id="task-date"
                label={draft.projectId ? "目标日期" : "计划日期"}
                hint="YYYY-MM-DD，可选"
                value={draft.dueDate ?? ""}
                onChange={(value) => setDraft({ ...draft, dueDate: value })}
              />
            </>
          ) : null}
          <div className="field-group">
            <label htmlFor="editor-notes">
              {entity === "domain"
                ? "当前理解"
                : entity === "project"
                  ? "项目笔记"
                  : entity === "task" && draft.projectId
                    ? "子目标说明"
                    : entity === "knowledgeNote"
                      ? "内容"
                      : "笔记"}
            </label>
            <textarea
              className="resize-none"
              id="editor-notes"
              rows={4}
              value={draft.note ?? draft.description ?? draft.summary ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  ...(entity === "project"
                    ? { description: event.target.value }
                    : entity === "domain"
                      ? { summary: event.target.value }
                      : { note: event.target.value }),
                })
              }
              placeholder="补充必要的上下文，不必一次写完。"
            />
          </div>
          {entity === "domain" ? (
            <div className="field-group">
              <label htmlFor="editor-next">下一步</label>
              <input
                id="editor-next"
                value={draft.nextStep ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    nextStep: event.target.value,
                  })
                }
                placeholder="写下一个具体行动…"
              />
            </div>
          ) : null}
          {error ? (
            <div id="editor-error" className="form-error" role="alert">
              {error}
            </div>
          ) : (
            <div className="form-error form-error--empty" aria-hidden="true" />
          )}
          <footer>
            {onDelete ? (
              <button
                className="button button--outline editor-delete-action"
                type="button"
                onClick={onDelete}
                disabled={saving}
              >
                删除
              </button>
            ) : null}
            <button
              className="button button--outline"
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              取消
            </button>
            <button
              className="button button--primary"
              type="submit"
              disabled={saving}
            >
              {saving
                ? editing
                  ? "正在保存…"
                  : "正在创建…"
                : editing
                  ? "保存更改"
                  : `创建${label}`}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function SearchDialog({
  snapshot,
  query,
  setQuery,
  onClose,
  onNavigate,
}: {
  snapshot: Snapshot | null;
  query: string;
  setQuery: (value: string) => void;
  onClose: () => void;
  onNavigate: (view: ViewKey) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, inputRef, onClose);
  const normalized = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!snapshot || !normalized) return [];
    return [
      ...snapshot.projects.map((item) => ({
        id: item.id,
        title: item.title,
        meta: "项目",
        view: "projects" as ViewKey,
      })),
      ...snapshot.tasks.map((item) => ({
        id: item.id,
        title: item.title,
        meta: "任务",
        view: "projects" as ViewKey,
      })),
      ...snapshot.domains.map((item) => ({
        id: item.id,
        title: item.title,
        meta: "学习领域",
        view: "learning" as ViewKey,
      })),
      ...snapshot.ideas.map((item) => ({
        id: item.id,
        title: item.title,
        meta: item.type === "question" ? "疑问" : "Idea",
        view: "ideas" as ViewKey,
      })),
      ...snapshot.events.map((item) => ({
        id: item.id,
        title: item.title,
        meta: "日程",
        view: "calendar" as ViewKey,
      })),
    ]
      .filter((item) => item.title.toLowerCase().includes(normalized))
      .slice(0, 12);
  }, [normalized, snapshot]);
  return (
    <div
      className="modal-backdrop modal-backdrop--command"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="command-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-title"
      >
        <h2 id="search-title" className="sr-only">
          全局搜索
        </h2>
        <div className="command-input">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
              if (
                event.key === "Enter" &&
                !event.nativeEvent.isComposing &&
                results.length === 1
              )
                onNavigate(results[0].view);
            }}
            placeholder="搜索任务、项目、领域或问题…"
            aria-label="全局搜索"
          />
          {query ? (
            <button
              type="button"
              aria-label="清除搜索"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              ×
            </button>
          ) : null}
          <kbd>ESC</kbd>
        </div>
        <div className="command-results" role="status">
          {!query ? (
            <p className="command-hint">输入关键词搜索全部工作台内容</p>
          ) : results.length ? (
            results.map((result) => (
              <button
                type="button"
                key={`${result.meta}-${result.id}`}
                onClick={() => onNavigate(result.view)}
              >
                <span>{result.title}</span>
                <small>{result.meta}</small>
              </button>
            ))
          ) : (
            <EmptyState
              title="没有匹配结果"
              description="尝试更短的关键词，或清除搜索。"
              action="清除搜索"
              onAction={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  tone = "warning",
  mark = "归",
  title,
  description,
  confirmLabel,
  savingLabel = "正在归档…",
  error = "",
  saving,
  onCancel,
  onConfirm,
}: {
  tone?: "warning" | "danger";
  mark?: string;
  title: string;
  description: string;
  confirmLabel: string;
  savingLabel?: string;
  error?: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, cancelRef, onCancel);
  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
      >
        <span className={`confirm-mark confirm-mark--${tone}`} aria-hidden="true">
          {mark}
        </span>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{description}</p>
        {error ? (
          <div className="confirm-error" role="alert">
            {error}
          </div>
        ) : null}
        <div>
          <button
            ref={cancelRef}
            className="button button--outline"
            type="button"
            onClick={onCancel}
            disabled={saving}
          >
            取消
          </button>
          <button
            className={`button button--${tone}`}
            type="button"
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? savingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function useDialogFocus(
  dialogRef: React.RefObject<HTMLDivElement | null>,
  initialRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  active = true,
) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const prior = document.activeElement as HTMLElement | null;
    const backgrounds = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".workspace-frame, .sidebar, .mobile-nav",
      ),
    );
    backgrounds.forEach((background) => background.setAttribute("inert", ""));
    window.setTimeout(() => initialRef.current?.focus(), 0);
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const elements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
        ),
      );
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      backgrounds.forEach((background) => background.removeAttribute("inert"));
      prior?.focus();
    };
  }, [active, dialogRef, initialRef]);
}

function TypedField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field-group">
      <label htmlFor={id}>
        {label}
        <span>{hint}</span>
      </label>
      <input
        id={id}
        value={value}
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function LoadingRegion() {
  return (
    <div className="loading-region" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>正在整理工作台…</p>
    </div>
  );
}
function EmptyState({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">○</span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action && onAction ? (
        <button className="text-button" type="button" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}
function StageMeter({ stage }: { stage: number }) {
  return (
    <div className="stage-meter" aria-label={`理解阶段 ${stage} / 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < stage ? "is-filled" : ""} />
      ))}
    </div>
  );
}

function entityLabel(entity: EntityName) {
  return {
    project: "项目",
    task: "任务",
    domain: "学习领域",
    idea: "线索",
    event: "日程",
    learningLog: "学习记录",
    knowledgeNote: "认知条目",
  }[entity];
}
function knowledgeNoteKindLabel(kind: KnowledgeNote["kind"]) {
  return {
    insight: "核心认知",
    branch: "知识分支",
    stage: "阶段总结",
    note: "笔记",
  }[kind];
}
function localDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
function formatFullDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}
function formatShortDate(value: string) {
  const [, month = "", day = ""] = value.split("-");
  return month && day ? `${Number(month)}月${Number(day)}日` : value;
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
function formatMonthDay(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
function formatRelative(value: string) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60_000),
  );
  return minutes < 1
    ? "刚刚"
    : minutes < 60
      ? `${minutes} 分钟前`
      : `${Math.round(minutes / 60)} 小时前`;
}
function parseShanghaiDateTime(date: string, time: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date || "") ||
    !/^\d{2}:\d{2}$/.test(time || "")
  )
    return null;
  const value = new Date(`${date}T${time}:00+08:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}
function clockLabel(minutes: number) {
  const bounded = Math.max(0, Math.min(24 * 60, minutes));
  const hour = Math.floor(bounded / 60);
  const minute = bounded % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function eventDraft(date: string, requestedMinute: number): EditorDraft {
  const startMinute = Math.max(8 * 60, Math.min(23 * 60, requestedMinute));
  return {
    date,
    start: clockLabel(startMinute),
    end: clockLabel(startMinute + 60),
  };
}
function shanghaiClockMinutes(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  return hour * 60 + minute;
}
function nowPosition(now: number) {
  const minute = shanghaiClockMinutes(new Date(now));
  if (minute < 8 * 60) return null;
  return `${Math.min(100, ((minute - 8 * 60) / (16 * 60)) * 100)}%`;
}
function eventGeometry(event: CalendarEvent) {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const startMinute = shanghaiClockMinutes(start);
  const top = Math.max(
    0,
    Math.min(100, ((startMinute - 8 * 60) / (16 * 60)) * 100),
  );
  const duration = Math.max(30, (end.getTime() - start.getTime()) / 60_000);
  return {
    top: `${top}%`,
    height: `${Math.max(3.125, Math.min(100 - top, (duration / (16 * 60)) * 100))}%`,
  };
}

function layoutCalendarDayEvents(events: CalendarEvent[]) {
  const laneEnds: number[] = [];
  const positioned = [...events]
    .sort(
      (left, right) =>
        new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
    )
    .map((event) => {
      const start = new Date(event.startAt).getTime();
      const end = Math.max(start + 30 * 60_000, new Date(event.endAt).getTime());
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(end);
      } else {
        laneEnds[lane] = end;
      }
      return { event, lane };
    });
  const laneCount = Math.max(1, laneEnds.length);
  return positioned.map((item) => ({ ...item, laneCount }));
}

function useCurrentTime() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}
function weekDays(date: Date) {
  const current = new Date(date);
  const day = current.getDay() || 7;
  const monday = new Date(current);
  monday.setDate(current.getDate() - day + 1);
  return Array.from({ length: 7 }, (_, index) => {
    const value = new Date(monday);
    value.setDate(monday.getDate() + index);
    const key = localDateKey(value);
    return {
      key,
      weekday: new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        weekday: "short",
      }).format(value),
      day: new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        day: "numeric",
      }).format(value),
      isToday: key === localDateKey(new Date()),
    };
  });
}
