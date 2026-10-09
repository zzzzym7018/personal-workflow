"use client";

import type {
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ViewKey =
  | "today"
  | "calendar"
  | "projects"
  | "learning"
  | "ideas"
  | "review"
  | "settings";
type EntityName =
  "project" | "task" | "domain" | "idea" | "event" | "learningLog";
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

export function WorkspaceApp({ initialViewer }: { initialViewer: Viewer }) {
  const [activeView, setActiveView] = useState<ViewKey>(() => {
    if (typeof window === "undefined") return "today";
    const view = new URLSearchParams(window.location.search).get(
      "view",
    ) as ViewKey | null;
    return view && navigation.some((item) => item.key === view)
      ? view
      : "today";
  });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<EntityName | null>(null);
  const [draft, setDraft] = useState<EditorDraft>({});
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<{
    entity: Exclude<EntityName, "learningLog">;
    id: string;
    title: string;
  } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const quickAddRef = useRef<HTMLButtonElement>(null);

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
    document.title = `${viewTitles[activeView]} — 知行台`;
    const url = new URL(window.location.href);
    url.searchParams.set("view", activeView);
    window.history.replaceState({ view: activeView }, "", url);
  }, [activeView]);

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

  function openEditor(entity: EntityName) {
    const date = localDateKey(new Date());
    setEditor(entity);
    setEditorError("");
    setDraft({
      type: entity === "idea" ? "idea" : "",
      date,
      start: "09:00",
      end: "10:00",
      occurredDate: date,
      minutes: "45",
      stage: "1",
      progress: "0",
    });
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setEditorError("");
    if (!draft.title?.trim()) {
      setEditorError("请先填写标题。 ");
      document.querySelector<HTMLInputElement>("#editor-title")?.focus();
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
    }
    if (editor === "learningLog") {
      data.occurredAt = parseShanghaiDateTime(draft.occurredDate, "12:00");
      data.minutes = Number(draft.minutes);
    }
    setSaving(true);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity: editor, data }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "创建失败，请重试。 ");
      await loadWorkspace();
      setEditor(null);
      notify(`${entityLabel(editor)}已创建`);
      window.setTimeout(
        () => document.querySelector<HTMLElement>("#workspace-main")?.focus(),
        0,
      );
    } catch (reason) {
      setEditorError(
        reason instanceof Error ? reason.message : "创建失败，请重试。 ",
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
                />
              ) : null}
              {activeView === "calendar" ? (
                <CalendarView
                  events={snapshot.events}
                  onCreate={() => openEditor("event")}
                  onArchive={(item) =>
                    setArchiveTarget({
                      entity: "event",
                      id: item.id,
                      title: item.title,
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
                  onUpdate={updateItem}
                  onArchive={(item) =>
                    setArchiveTarget({
                      entity: "project",
                      id: item.id,
                      title: item.title,
                    })
                  }
                />
              ) : null}
              {activeView === "learning" ? (
                <LearningView
                  domains={snapshot.domains}
                  ideas={snapshot.ideas}
                  logs={snapshot.learningLogs}
                  onCreateDomain={() => openEditor("domain")}
                  onCreateLog={() => openEditor("learningLog")}
                  onUpdate={updateItem}
                />
              ) : null}
              {activeView === "ideas" ? (
                <IdeasView
                  ideas={snapshot.ideas}
                  projects={snapshot.projects}
                  domains={snapshot.domains}
                  onCreate={() => openEditor("idea")}
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
          snapshot={snapshot}
          onClose={() => {
            setEditor(null);
            window.setTimeout(() => quickAddRef.current?.focus(), 0);
          }}
          onSubmit={createItem}
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
}: {
  snapshot: Snapshot;
  todayEvents: CalendarEvent[];
  todayKey: string;
  onNavigate: (view: ViewKey) => void;
  onToggleTask: (task: Task) => void;
  onOpenEditor: (entity: EntityName) => void;
}) {
  const todayTasks = snapshot.tasks.filter(
    (task) =>
      task.dueDate === todayKey ||
      (task.startAt && localDateKey(new Date(task.startAt)) === todayKey),
  );
  const focus =
    todayEvents.find((item) => item.title.includes("实验方案")) ??
    todayEvents[0];
  return (
    <div className="today-layout page-enter">
      <section className="today-primary">
        <div className="focus-card">
          <div className="focus-accent" aria-hidden="true" />
          <div>
            <p className="eyebrow">PRIMARY FOCUS</p>
            <h2>{focus?.title ?? "为今天选择一个主要行动"}</h2>
            <p>
              {focus
                ? `${formatTime(focus.startAt)}—${formatTime(focus.endAt)} · ${focus.projectId ? "项目深度工作" : "专注时间"}`
                : "从日程或任务中安排一段专注时间。"}
            </p>
          </div>
          <button
            className="button button--outline"
            type="button"
            onClick={() => onOpenEditor("event")}
          >
            {focus ? "调整时间" : "安排专注"}
          </button>
        </div>
        <Timeline events={todayEvents} />
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
          <div className="task-list">
            {todayTasks.length ? (
              todayTasks.map((task) => (
                <label key={task.id} className="task-row">
                  <input
                    type="checkbox"
                    checked={task.status === "done"}
                    onChange={() => onToggleTask(task)}
                  />
                  <span className={task.status === "done" ? "is-done" : ""}>
                    {task.title}
                  </span>
                  <span className="tag">
                    {task.projectId ? "项目" : "任务"}
                  </span>
                </label>
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
          {snapshot.projects.map((project) => (
            <div className="progress-item" key={project.id}>
              <div>
                <strong>{project.title}</strong>
                <span>{project.progress}%</span>
              </div>
              <div className="progress-track">
                <span
                  style={{
                    width: `${project.progress}%`,
                    background: project.color,
                  }}
                />
              </div>
              <p>下一步 · {project.nextAction || "确定下一步行动"}</p>
            </div>
          ))}
        </section>
        <section className="panel compact-panel">
          <div className="panel-heading">
            <h2>领域学习</h2>
            <button
              className="text-button"
              type="button"
              onClick={() => onNavigate("learning")}
            >
              知识观测图
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

function Timeline({ events }: { events: CalendarEvent[] }) {
  const hours = Array.from({ length: 11 }, (_, index) => index + 8);
  return (
    <section className="panel timeline-panel" aria-labelledby="timeline-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">TIME RAIL</p>
          <h2 id="timeline-title">今天的时间</h2>
        </div>
        <span>Asia / Shanghai</span>
      </div>
      <div
        className="timeline"
        style={{ "--timeline-hours": hours.length - 1 } as CSSProperties}
      >
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
        <div
          className="now-line"
          style={{ "--now-position": nowPosition() } as CSSProperties}
        >
          <span>现在</span>
        </div>
        {events.map((event) => {
          const geometry = eventGeometry(event);
          return (
            <article
              key={event.id}
              className={`timeline-event ${event.title.includes("实验方案") ? "is-focus" : ""}`}
              style={
                {
                  "--event-top": geometry.top,
                  "--event-height": geometry.height,
                  "--event-color": event.color,
                } as CSSProperties
              }
            >
              <div>
                <strong>{event.title}</strong>
                <span>
                  {event.source === "google"
                    ? "Google Calendar"
                    : event.projectId
                      ? "项目时间"
                      : "站内日程"}
                </span>
              </div>
              <time>
                {formatTime(event.startAt)}—{formatTime(event.endAt)}
              </time>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CalendarView({
  events,
  onCreate,
  onArchive,
  googleStatus,
  onSync,
  syncing,
}: {
  events: CalendarEvent[];
  onCreate: () => void;
  onArchive: (event: CalendarEvent) => void;
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
          <p>站内日程与选中的 Google 日历保持双向同步。</p>
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
            onClick={onCreate}
          >
            ＋ 新建日程
          </button>
        </div>
      </section>
      {mode === "week" ? (
        <section className="panel week-board" aria-label="本周日程">
          <div className="week-header">
            <span>时间</span>
            {days.map((day) => (
              <div key={day.key} className={day.isToday ? "is-today" : ""}>
                <strong>{day.weekday}</strong>
                <span>{day.day}</span>
              </div>
            ))}
          </div>
          <div className="week-grid">
            {Array.from({ length: 11 }, (_, index) => index + 8).map((hour) => (
              <div className="week-row" key={hour}>
                <time>{String(hour).padStart(2, "0")}:00</time>
                {days.map((day) => (
                  <div key={day.key}>
                    {events
                      .filter(
                        (event) =>
                          localDateKey(new Date(event.startAt)) === day.key &&
                          new Date(event.startAt).getHours() === hour,
                      )
                      .map((event) => (
                        <button
                          type="button"
                          key={event.id}
                          className="week-event"
                          style={{ borderLeftColor: event.color }}
                          onClick={() => onArchive(event)}
                        >
                          <strong>{event.title}</strong>
                          <span>{formatTime(event.startAt)}</span>
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <AgendaList events={events} onArchive={onArchive} />
      )}
    </div>
  );
}

function AgendaList({
  events,
  onArchive,
}: {
  events: CalendarEvent[];
  onArchive: (event: CalendarEvent) => void;
}) {
  return (
    <section className="panel agenda-panel">
      <div className="panel-heading">
        <h2>接下来的日程</h2>
        <span>{events.length} 项</span>
      </div>
      {events.length ? (
        <div className="agenda-list">
          {events.slice(0, 30).map((event) => (
            <article key={event.id} className="agenda-row">
              <time>
                {formatMonthDay(event.startAt)}
                <strong>{formatTime(event.startAt)}</strong>
              </time>
              <span
                className="agenda-dot"
                style={{ background: event.color }}
              />
              <div>
                <strong>{event.title}</strong>
                <span>
                  {event.source === "google" ? "Google Calendar" : "站内日程"}
                </span>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label={`归档日程 ${event.title}`}
                onClick={() => onArchive(event)}
              >
                ···
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="还没有日程"
          description="创建一个日程，把计划变成时间承诺。"
        />
      )}
    </section>
  );
}

function ProjectsView({
  projects,
  tasks,
  onCreate,
  onUpdate,
  onArchive,
}: {
  projects: Project[];
  tasks: Task[];
  onCreate: () => void;
  onUpdate: (
    entity: EntityName,
    id: string,
    data: Record<string, unknown>,
    message?: string,
  ) => void;
  onArchive: (project: Project) => void;
}) {
  const statuses = [
    { key: "todo", label: "待开始" },
    { key: "doing", label: "进行中" },
    { key: "done", label: "已完成" },
  ];
  return (
    <div className="page-stack page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">PROJECTS</p>
          <h2>每个项目都应该有清楚的下一步</h2>
          <p>在看板中推进任务，在项目卡中维护里程碑和整体进度。</p>
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
        {projects.map((project) => (
          <article className="panel project-card" key={project.id}>
            <div className="project-card-head">
              <span className="project-code">
                P-{project.id.slice(-2).toUpperCase()}
              </span>
              <button
                className="icon-button"
                type="button"
                aria-label={`归档项目 ${project.title}`}
                onClick={() => onArchive(project)}
              >
                ···
              </button>
            </div>
            <h3>{project.title}</h3>
            <p>{project.description}</p>
            <div className="progress-track">
              <span
                style={{
                  width: `${project.progress}%`,
                  background: project.color,
                }}
              />
            </div>
            <div className="project-meta">
              <span>{project.progress}%</span>
              <span>
                {
                  tasks.filter(
                    (task) =>
                      task.projectId === project.id && task.status === "done",
                  ).length
                }{" "}
                / {tasks.filter((task) => task.projectId === project.id).length}{" "}
                任务
              </span>
            </div>
            <p className="next-action">
              <span>下一步</span>
              {project.nextAction || "确定下一步行动"}
            </p>
            <div className="stepper-actions">
              <button
                type="button"
                onClick={() =>
                  onUpdate(
                    "project",
                    project.id,
                    { progress: Math.max(0, project.progress - 10) },
                    "项目进度已更新",
                  )
                }
              >
                −10%
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdate(
                    "project",
                    project.id,
                    { progress: Math.min(100, project.progress + 10) },
                    "项目进度已更新",
                  )
                }
              >
                ＋10%
              </button>
            </div>
          </article>
        ))}
      </div>
      <section className="kanban" aria-label="项目任务看板">
        {statuses.map((status) => (
          <div className="kanban-column" key={status.key}>
            <div className="kanban-heading">
              <h3>{status.label}</h3>
              <span>
                {tasks.filter((task) => task.status === status.key).length}
              </span>
            </div>
            {tasks
              .filter((task) => task.status === status.key)
              .map((task) => (
                <article className="kanban-card" key={task.id}>
                  <span className={`priority priority--${task.priority}`}>
                    {task.priority === "high" ? "高优先" : "任务"}
                  </span>
                  <h4>{task.title}</h4>
                  <p>
                    {task.notes ||
                      projects.find((project) => project.id === task.projectId)
                        ?.title ||
                      "未分配项目"}
                  </p>
                  <div className="kanban-actions">
                    {status.key !== "todo" ? (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdate(
                            "task",
                            task.id,
                            {
                              status: status.key === "done" ? "doing" : "todo",
                            },
                            "任务状态已更新",
                          )
                        }
                      >
                        ←
                      </button>
                    ) : (
                      <span />
                    )}
                    {status.key !== "done" ? (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdate(
                            "task",
                            task.id,
                            {
                              status: status.key === "todo" ? "doing" : "done",
                            },
                            "任务状态已更新",
                          )
                        }
                      >
                        →
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                </article>
              ))}
          </div>
        ))}
      </section>
    </div>
  );
}

function LearningView({
  domains,
  ideas,
  logs,
  onCreateDomain,
  onCreateLog,
  onUpdate,
}: {
  domains: Domain[];
  ideas: Idea[];
  logs: LearningLog[];
  onCreateDomain: () => void;
  onCreateLog: () => void;
  onUpdate: (
    entity: EntityName,
    id: string,
    data: Record<string, unknown>,
    message?: string,
  ) => void;
}) {
  const [selectedId, setSelectedId] = useState(domains[0]?.id ?? "");
  const selected =
    domains.find((domain) => domain.id === selectedId) ?? domains[0];
  return (
    <div className="page-stack page-enter">
      <section className="page-intro">
        <div>
          <p className="eyebrow">LEARNING DOMAINS</p>
          <h2>记录理解的变化，而不是收藏材料</h2>
          <p>领域、疑问和项目围绕真实的学习进展形成可探索轨迹。</p>
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
      <div className="learning-layout">
        <KnowledgeOrbit
          domains={domains}
          ideas={ideas}
          selectedId={selected?.id}
          onSelect={setSelectedId}
        />
        <aside className="panel learning-detail">
          {selected ? (
            <>
              <p className="eyebrow">CURRENT DOMAIN</p>
              <h2>{selected.title}</h2>
              <span className="stage-label">
                阶段 {String(selected.stage).padStart(2, "0")} / 05 ·{" "}
                {stageLabels[selected.stage - 1]}
              </span>
              <StageMeter stage={selected.stage} />
              <div className="detail-section">
                <h3>当前理解</h3>
                <p>{selected.summary || "还没有理解摘要。"}</p>
              </div>
              <div className="detail-section">
                <h3>下一步</h3>
                <p>{selected.nextStep || "确定下一步学习行动。"}</p>
              </div>
              <div className="stage-controls">
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
            </>
          ) : (
            <EmptyState
              title="还没有学习领域"
              description="创建一个领域，开始记录理解进度。"
              action="新建领域"
              onAction={onCreateDomain}
            />
          )}
        </aside>
      </div>
      <section className="panel log-panel">
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

function KnowledgeOrbit({
  domains,
  ideas,
  selectedId,
  onSelect,
}: {
  domains: Domain[];
  ideas: Idea[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel orbit-panel" aria-labelledby="orbit-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">KNOWLEDGE ORBITS</p>
          <h2 id="orbit-title">知识观测图</h2>
        </div>
        <span>选择节点查看进展</span>
      </div>
      <div className="orbit-map">
        <div className="orbit orbit--outer" aria-hidden="true" />
        <div className="orbit orbit--middle" aria-hidden="true" />
        <div className="orbit orbit--inner" aria-hidden="true" />
        <div className="orbit-core">
          <span>CURRENT</span>
          <strong>研究核心</strong>
        </div>
        {domains.map((domain, index) => (
          <button
            key={domain.id}
            type="button"
            className={`orbit-node orbit-node--${index % 4} ${selectedId === domain.id ? "is-selected" : ""}`}
            style={{ "--node-color": domain.color } as CSSProperties}
            onClick={() => onSelect(domain.id)}
          >
            <span>DOMAIN</span>
            <strong>{domain.title}</strong>
            <small>阶段 {String(domain.stage).padStart(2, "0")} / 05</small>
          </button>
        ))}
        {ideas
          .filter(
            (idea) => idea.type === "question" && idea.status !== "resolved",
          )
          .slice(0, 2)
          .map((idea, index) => (
            <div
              className={`orbit-question orbit-question--${index}`}
              key={idea.id}
            >
              <span>?</span>
              <p>{idea.title}</p>
            </div>
          ))}
      </div>
    </section>
  );
}

function IdeasView({
  ideas,
  projects,
  domains,
  onCreate,
  onUpdate,
  onArchive,
}: {
  ideas: Idea[];
  projects: Project[];
  domains: Domain[];
  onCreate: () => void;
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
            {snapshot.projects[0]?.nextAction || "为最重要的项目确定下一步。"}
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
  snapshot,
  onClose,
  onSubmit,
}: {
  entity: EntityName;
  draft: EditorDraft;
  setDraft: (draft: EditorDraft) => void;
  error: string;
  saving: boolean;
  snapshot: Snapshot | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, titleRef, onClose);
  const label = entityLabel(entity);
  return (
    <div
      className="modal-backdrop"
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
            <h2 id="editor-dialog-title">创建{label}</h2>
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
            <input
              ref={titleRef}
              id="editor-title"
              value={draft.title ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              aria-invalid={Boolean(error && !draft.title?.trim())}
              aria-describedby={error ? "editor-error" : undefined}
              placeholder={
                entity === "idea" ? "记录一个想法或疑问…" : `填写${label}标题…`
              }
            />
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
            <div className="field-row">
              <TypedField
                id="project-progress"
                label="当前进度"
                hint="0–100"
                value={draft.progress ?? "0"}
                onChange={(value) => setDraft({ ...draft, progress: value })}
              />
              <TypedField
                id="project-deadline"
                label="截止日期"
                hint="YYYY-MM-DD"
                value={draft.deadline ?? ""}
                onChange={(value) => setDraft({ ...draft, deadline: value })}
              />
            </div>
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
              <div className="field-group">
                <label htmlFor="task-project">关联项目</label>
                <select
                  id="task-project"
                  value={draft.projectId ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, projectId: event.target.value })
                  }
                >
                  <option value="">暂不关联</option>
                  {snapshot?.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
              <TypedField
                id="task-date"
                label="计划日期"
                hint="YYYY-MM-DD"
                value={draft.dueDate ?? draft.date ?? ""}
                onChange={(value) => setDraft({ ...draft, dueDate: value })}
              />
            </>
          ) : null}
          <div className="field-group">
            <label htmlFor="editor-notes">
              {entity === "domain"
                ? "当前理解"
                : entity === "project"
                  ? "项目说明"
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
          {entity === "project" || entity === "domain" ? (
            <div className="field-group">
              <label htmlFor="editor-next">下一步</label>
              <input
                id="editor-next"
                value={draft.nextAction ?? draft.nextStep ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    ...(entity === "project"
                      ? { nextAction: event.target.value }
                      : { nextStep: event.target.value }),
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
              {saving ? "正在创建…" : `创建${label}`}
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
  title,
  description,
  confirmLabel,
  saving,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
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
        <span className="confirm-mark" aria-hidden="true">
          归
        </span>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{description}</p>
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
            className="button button--warning"
            type="button"
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? "正在归档…" : confirmLabel}
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
) {
  useEffect(() => {
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
        onClose();
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
  }, [dialogRef, initialRef, onClose]);
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
  }[entity];
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
function nowPosition() {
  const value = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 8);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  return `${Math.max(0, Math.min(100, ((hour + minute / 60 - 8) / 10) * 100))}%`;
}
function eventGeometry(event: CalendarEvent) {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const startParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(start);
  const hour = Number(
    startParts.find((part) => part.type === "hour")?.value ?? 8,
  );
  const minute = Number(
    startParts.find((part) => part.type === "minute")?.value ?? 0,
  );
  const top = Math.max(0, Math.min(98, ((hour + minute / 60 - 8) / 10) * 100));
  const duration = Math.max(30, (end.getTime() - start.getTime()) / 60_000);
  return {
    top: `${top}%`,
    height: `${Math.max(5.5, Math.min(18, (duration / 600) * 100))}%`,
  };
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
