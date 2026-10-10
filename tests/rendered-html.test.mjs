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
  assert.match(workspace, /知识观测图/);
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
  assert.match(styles, /\.week-calendar-scroll \{[^}]*scroll-snap-type: x proximity/);
  assert.match(client, /scrollArea\.scrollLeft = Math\.max/);
});

test("projects own checkable subgoals while calendar events stay independent", async () => {
  const [client, api, google, migration] = await Promise.all([
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
  ]);
  assert.match(client, /onCreateSubgoal=\{\(projectId\)/);
  assert.match(client, /className="project-subgoal-row"/);
  assert.match(client, /checked=\{task\.status === "done"\}/);
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
  assert.match(api, /data\.type !== undefined/);
  assert.match(styles, /\.idea-card-edit-target/);
});
