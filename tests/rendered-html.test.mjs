import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the private workspace shell", async () => {
  const [page, layout, workspace] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/workspace/WorkspaceApp.tsx", import.meta.url), "utf8"),
    access(new URL("../dist/server/index.js", import.meta.url)),
  ]);
  assert.match(page, /requireAllowedViewer/);
  assert.match(page, /WorkspaceApp/);
  assert.match(layout, /知行台/);
  assert.match(layout, /og-zhixing-desk\.png/);
  assert.match(workspace, /aria-label="主要导航"/);
  assert.match(workspace, /领域书架/);
  assert.doesNotMatch(workspace, /知识观测图|KnowledgeOrbit/);
  assert.doesNotMatch(page + layout + workspace, /react-loading-skeleton|Your site is taking shape/);
});

test("keeps privacy and Google tokens on the server", async () => {
  const [auth, calendar, client] = await Promise.all([
    readFile(new URL("../app/lib/server-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/google-calendar.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/workspace/WorkspaceApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(auth, /ALLOWED_USER_EMAIL/);
  assert.match(calendar, /AES-GCM/);
  assert.match(calendar, /GOOGLE_TOKEN_ENCRYPTION_KEY/);
  assert.doesNotMatch(client, /GOOGLE_CLIENT_SECRET|GOOGLE_TOKEN_ENCRYPTION_KEY|access_token/);
});

test("keeps dialog focus stable while users type with an IME", async () => {
  const client = await readFile(
    new URL("../app/workspace/WorkspaceApp.tsx", import.meta.url),
    "utf8",
  );
  assert.match(client, /const onCloseRef = useRef\(onClose\)/);
  assert.match(client, /onCloseRef\.current\(\)/);
  assert.match(client, /\[active, dialogRef, initialRef\]/);
  assert.doesNotMatch(client, /\[dialogRef, initialRef, onClose\]/);
});

test("today follows the current schedule and exposes complete scrollable queues", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../app/workspace/WorkspaceApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /当前时段 · NOW/);
  assert.match(client, /Array\.from\(\{ length: 17 \}/);
  assert.match(client, /className="timeline-scroll"/);
  assert.match(client, /className="project-list scroll-region"/);
  assert.match(client, /function openEventEditor\(event: CalendarEvent\)/);
  assert.match(client, /onClick=\{\(\) => onEditEvent\(event\)\}/);
  assert.match(client, /method: editing \? "PATCH" : "POST"/);
  assert.match(client, /editing\s*\? "保存更改"/);
  assert.match(client, /data\.notes = draft\.note \?\? ""/);
  assert.doesNotMatch(client, /title\.includes\("实验方案"\)/);
  assert.match(styles, /\.timeline-scroll \{[^}]*overflow-y: auto/);
  assert.match(styles, /\.timeline-event \{[^}]*cursor: pointer/);
  assert.match(styles, /\.timeline-event:focus-visible/);
  assert.match(styles, /\.project-list \{[^}]*overflow-y: auto/);
});

test("event notes survive save and reopen field mapping", async () => {
  const [client, api] = await Promise.all([
    readFile(new URL("../app/workspace/WorkspaceApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /note: event\.notes/);
  assert.match(client, /data\.notes = draft\.note \?\? ""/);
  assert.match(api, /data\.notes !== undefined \|\| data\.note !== undefined/);
  assert.match(api, /notes: optionalText\(data\.notes \?\? data\.note\)/);
});

test("new tasks persist the date shown in the editor", async () => {
  const client = await readFile(
    new URL("../app/workspace/WorkspaceApp.tsx", import.meta.url),
    "utf8",
  );
  assert.match(client, /dueDate: entity === "task" \? date : ""/);
  assert.match(client, /value=\{draft\.dueDate \?\? ""\}/);
  assert.doesNotMatch(client, /draft\.dueDate \?\? draft\.date/);
});

test("calendar grids open the shared event editor with time defaults", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../app/workspace/WorkspaceApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /function openEditor\(entity: EntityName, defaults: EditorDraft = \{\}\)/);
  assert.match(client, /className="timeline-create-layer"/);
  assert.match(client, /className="week-day-create-layer"/);
  assert.match(client, /function layoutCalendarDayEvents/);
  assert.match(client, /"--event-top": geometry\.top/);
  assert.match(client, /Math\.round\([\s\S]*\* 64/);
  assert.match(client, /点击空白时间快速添加/);
  assert.match(styles, /\.timeline-create-layer:focus-visible/);
  assert.match(styles, /\.week-day-create-layer:focus-visible/);
  assert.match(styles, /\.week-calendar-body \{[^}]*height: 1024px/);
  assert.match(styles, /\.week-calendar-canvas \{[^}]*min-width: 1546px/);
  assert.doesNotMatch(styles, /scroll-snap-type|scroll-snap-align/);
  assert.match(client, /scrollArea\.scrollLeft = Math\.max/);
  assert.match(client, /const hasPositionedRef = useRef\(false\)/);
  assert.match(client, /useLayoutEffect\(\(\) => \{/);
  assert.match(client, /if \(!scrollArea \|\| hasPositionedRef\.current\) return/);
});

test("agenda separates unfinished DDL tasks from future calendar events", async () => {
  const [client, api, styles] = await Promise.all([
    readFile(new URL("../app/workspace/WorkspaceApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /tasks=\{snapshot\.tasks\}/);
  assert.match(client, /task\.status !== "done" && task\.dueDate/);
  assert.match(client, /new Date\(event\.endAt\)\.getTime\(\) >= now/);
  assert.match(client, /待完成任务/);
  assert.match(client, /未来日程/);
  assert.match(client, /没有未完成且设有 DDL 的任务/);
  assert.match(client, /目前没有尚未结束的未来日程/);
  assert.match(client, /function openTaskEditor\(task: Task/);
  assert.match(client, /onChange=\{\(\) => onToggleTask\(task\)\}/);
  assert.match(client, /id=\{`today-task-\$\{task\.id\}`\}/);
  assert.match(client, /aria-label=\{`编辑任务「\$\{task\.title\}」和 DDL`\}/);
  assert.match(client, /onClick=\{\(\) => onEditTask\(task\)\}/);
  assert.match(client, /label=\{draft\.projectId \? "子目标 DDL" : "任务 DDL"\}/);
  assert.match(styles, /\.task-row-open \{[^}]*grid-template-columns: minmax\(0, 1fr\) 10px/);
  assert.doesNotMatch(client, /events\.slice\(0, 30\)/);
  assert.match(api, /data\.notes !== undefined \|\| data\.note !== undefined/);
  assert.match(styles, /\.agenda-groups \{[^}]*grid-template-columns: repeat\(2/);
  assert.match(styles, /@media \(max-width: 880px\)[\s\S]*\.agenda-groups \{ grid-template-columns: 1fr/);
});

test("projects own three-state subgoals while calendar events stay independent", async () => {
  const [client, api, google, migration, styles] = await Promise.all([
    readFile(new URL("../app/workspace/WorkspaceApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/google-calendar.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../drizzle/0002_detach_calendar_events_from_projects.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /onCreateSubgoal=\{\(projectId\)/);
  assert.match(client, /className="project-subgoal-row"/);
  assert.match(client, /\{ value: "todo", label: "未开启" \}/);
  assert.match(client, /\{ value: "doing", label: "进行中" \}/);
  assert.match(client, /\{ value: "done", label: "已完成" \}/);
  assert.match(client, /function SubgoalStatusPicker\(/);
  assert.match(client, /aria-expanded=\{open\}/);
  assert.match(client, /open \? \(/);
  assert.match(client, /triggerRef\.current\?\.focus\(\)/);
  assert.match(client, /aria-pressed=\{task\.status === status\.value\}/);
  assert.match(client, /\{ status: status\.value \}/);
  assert.match(styles, /\.project-subgoal-status-trigger\.is-doing/);
  assert.match(styles, /grid-template-areas: "title status due delete"/);
  assert.match(styles, /\.project-subgoal-status-options \{ position: absolute/);
  assert.match(styles, /\.project-subgoal-status-option\[aria-pressed="true"\]/);
  assert.match(styles, /\.project-subgoal-status-option\.is-doing \.project-subgoal-status-dot/);
  assert.match(styles, /\.project-subgoal-status-option\.is-done \.project-subgoal-status-dot/);
  assert.match(client, /function openProjectEditor\(project: Project\)/);
  assert.match(client, /onEdit=\{openProjectEditor\}/);
  assert.match(client, /id=\{`project-edit-\$\{project\.id\}`\}/);
  assert.match(client, /className="project-card-edit-target"/);
  assert.match(client, /description: project\.description/);
  assert.match(client, /deadline: project\.deadline \?\? ""/);
  assert.match(client, /document\.getElementById\(returnFocusId\)/);
  assert.doesNotMatch(client, /id="project-progress"|−10%|＋10%|id="task-project"/);
  assert.match(api, /data\.description !== undefined/);
  assert.match(api, /data\.deadline !== undefined/);
  assert.match(api, /syncStatus: "pending", projectId: null/);
  assert.match(google, /projectId: null/);
  assert.match(migration, /UPDATE `events`[\s\S]*`project_id` = NULL/);
});

test("schedules, goals, and projects expose confirmed permanent deletion", async () => {
  const [client, api, google, styles] = await Promise.all([
    readFile(new URL("../app/workspace/WorkspaceApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/google-calendar.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /action: "delete"/);
  assert.match(client, /永久删除「\$\{deleteTarget\.title\}」/);
  assert.match(client, /className="row-action row-action--delete"/);
  assert.match(client, /aria-label={`删除项目 \$\{project\.title\}`}/);
  assert.match(client, />\s*×\s*<\/button>/);
  assert.match(client, /该项目及其 \$\{childCount\} 个子目标将被永久删除/);
  assert.match(client, /同时从 Google Calendar 和知行台永久删除/);
  assert.match(client, /error=\{deleteError\}/);
  assert.doesNotMatch(client, /window\.confirm|confirm\(/);
  assert.match(api, /body\.action === "delete"/);
  assert.match(api, /db\.delete\(tasks\)\.where\(eq\(tasks\.projectId, body\.id\)\)/);
  assert.match(api, /db\.update\(ideas\)\.set\(\{ projectId: null, updatedAt \}\)/);
  assert.match(api, /deleteGoogleCalendarEvent/);
  assert.match(google, /method: "DELETE"/);
  assert.match(styles, /\.button--danger/);
  assert.match(styles, /\.row-action--delete/);
});

test("idea and question cards open a prefilled shared editor", async () => {
  const [client, api, styles] = await Promise.all([
    readFile(new URL("../app/workspace/WorkspaceApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /function openIdeaEditor\(idea: Idea\)/);
  assert.match(client, /onEdit=\{openIdeaEditor\}/);
  assert.match(client, /id=\{`idea-edit-\$\{idea\.id\}`\}/);
  assert.match(client, /className="idea-card-edit-target"/);
  assert.match(client, /type: idea\.type/);
  assert.match(client, /note: idea\.note/);
  assert.match(client, /projectId: idea\.projectId \?\? ""/);
  assert.match(client, /domainId: idea\.domainId \?\? ""/);
  assert.match(client, /id="idea-domain"/);
  assert.match(client, /id="idea-project"/);
  assert.match(client, /className="editor-title-textarea resize-none"/);
  assert.match(client, /Math\.min\(titleRef\.current\.scrollHeight, 144\)/);
  assert.match(api, /data\.type !== undefined/);
  assert.match(styles, /\.idea-card-edit-target/);
  assert.match(styles, /\.editor-title-textarea \{[^}]*min-height: 64px[^}]*max-height: 144px/);
});

test("core pages keep distinct themes and balanced desktop layouts", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../app/workspace/WorkspaceApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /page-intro page-intro--calendar/);
  assert.match(client, /page-intro page-intro--projects/);
  assert.match(client, /page-intro page-intro--learning/);
  assert.match(client, /page-intro page-intro--review/);
  assert.match(client, /page-intro page-intro--settings/);
  assert.match(client, /<div className="idea-grid">/);
  assert.match(client, /settings-panel settings-panel--calendar/);
  assert.match(client, /project-edit-hint/);
  assert.doesNotMatch(client, />\s*创建子目标\s*<\/button>/);
  assert.match(styles, /\.page-intro--calendar::before/);
  assert.match(styles, /\.idea-grid \{[^}]*grid-template-columns: repeat\(3/);
  assert.match(styles, /\.settings-layout \{[^}]*grid-template-columns: repeat\(2/);
});

test("learning uses editable cognitive records and scoped notes", async () => {
  const [client, api, database, schema, styles, migration] = await Promise.all([
    readFile(new URL("../app/workspace/WorkspaceApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/workspace-db.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_oval_hellcat.sql", import.meta.url), "utf8"),
  ]);
  assert.match(client, /className="domain-shelf"/);
  assert.match(client, /核心认知/);
  assert.match(client, /知识分支/);
  assert.match(client, /分阶段总结/);
  assert.match(client, /领域内/);
  assert.match(client, /跨领域/);
  assert.match(client, /domain\.stage >= 5 \? "已完成" : "学习中"/);
  assert.match(client, /function openKnowledgeNoteEditor/);
  assert.match(client, /editor === "event" \|\| editor === "project" \|\| editor === "domain"/);
  assert.match(client, /该领域及其 \$\{knowledgeCount\} 条认知与笔记、\$\{logCount\} 条学习记录将被永久删除/);
  assert.match(client, /id="knowledge-kind"/);
  assert.match(client, /id="knowledge-domain"/);
  assert.match(client, /onEditNote={openKnowledgeNoteEditor}/);
  assert.match(api, /case "knowledgeNote"/);
  assert.match(api, /db\.insert\(knowledgeNotes\)/);
  assert.match(api, /db\.update\(knowledgeNotes\)/);
  assert.match(api, /db\.delete\(knowledgeNotes\)\.where\(eq\(knowledgeNotes\.domainId, body\.id\)\)/);
  assert.match(api, /db\.delete\(learningLogs\)\.where\(eq\(learningLogs\.domainId, body\.id\)\)/);
  assert.match(api, /db\.update\(tasks\)\.set\(\{ domainId: null, updatedAt \}\)/);
  assert.match(api, /db\.update\(ideas\)\.set\(\{ domainId: null, updatedAt \}\)/);
  assert.match(database, /knowledgeNoteRows/);
  assert.match(schema, /export const knowledgeNotes = sqliteTable\("knowledge_notes"/);
  assert.match(styles, /\.learning-workbench/);
  assert.match(styles, /\.domain-shelf \{[^}]*grid-auto-flow: column[^}]*overflow-x: auto/);
  assert.match(styles, /\.domain-shelf-card/);
  assert.doesNotMatch(styles, /\.domain-shelf \{ grid-template-columns: 1fr; \}/);
  assert.match(styles, /\.stage-timeline/);
  assert.match(migration, /CREATE TABLE `knowledge_notes`/);
});
