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
  assert.match(client, /\[dialogRef, initialRef\]/);
  assert.doesNotMatch(client, /\[dialogRef, initialRef, onClose\]/);
});
