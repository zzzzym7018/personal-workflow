import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { events, googleCalendars, googleConnections } from "../../db/schema";
import { ensureWorkspaceSchema, getGoogleConnection, getSelectedGoogleCalendars, nowIso } from "./workspace-db";

type RuntimeEnv = {
  GOOGLE_ALLOWED_EMAIL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_TOKEN_ENCRYPTION_KEY?: string;
  GOOGLE_OAUTH_STATE_SECRET?: string;
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

type GoogleCalendarItem = {
  id: string;
  summary?: string;
  backgroundColor?: string;
  accessRole?: string;
  primary?: boolean;
};

type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  colorId?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  updated?: string;
};

export function getGoogleConfig() {
  const runtimeEnv = env as unknown as RuntimeEnv;
  const config = {
    allowedGoogleEmail: runtimeEnv.GOOGLE_ALLOWED_EMAIL,
    clientId: runtimeEnv.GOOGLE_CLIENT_ID,
    clientSecret: runtimeEnv.GOOGLE_CLIENT_SECRET,
    encryptionKey: runtimeEnv.GOOGLE_TOKEN_ENCRYPTION_KEY,
    stateSecret: runtimeEnv.GOOGLE_OAUTH_STATE_SECRET,
  };
  if (!config.allowedGoogleEmail || !config.clientId || !config.clientSecret || !config.encryptionKey || !config.stateSecret) {
    throw new Error("GOOGLE_CONFIG_MISSING");
  }
  return config as Record<keyof typeof config, string>;
}

export async function createOAuthState(email: string) {
  const { stateSecret } = getGoogleConfig();
  const payload = encodeBase64Url(JSON.stringify({ email, exp: Date.now() + 10 * 60_000, nonce: crypto.randomUUID() }));
  const signature = await hmac(payload, stateSecret);
  return `${payload}.${signature}`;
}

export async function verifyOAuthState(state: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) throw new Error("INVALID_OAUTH_STATE");
  const { stateSecret } = getGoogleConfig();
  const expected = await hmac(payload, stateSecret);
  if (!constantTimeEqual(signature, expected)) throw new Error("INVALID_OAUTH_STATE");
  const value = JSON.parse(decodeBase64Url(payload)) as { email: string; exp: number };
  if (!value.email || value.exp < Date.now()) throw new Error("EXPIRED_OAUTH_STATE");
  return value;
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getGoogleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!response.ok) throw new Error("GOOGLE_TOKEN_EXCHANGE_FAILED");
  return (await response.json()) as TokenResponse;
}

export async function saveGoogleConnection(userEmail: string, token: TokenResponse) {
  await ensureWorkspaceSchema();
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
  if (!profileResponse.ok) throw new Error("GOOGLE_PROFILE_FAILED");
  const profile = (await profileResponse.json()) as { email?: string };
  const { allowedGoogleEmail } = getGoogleConfig();
  if (!profile.email || profile.email.toLowerCase() !== allowedGoogleEmail.toLowerCase()) throw new Error("GOOGLE_EMAIL_MISMATCH");

  const now = nowIso();
  const existing = await getGoogleConnection(userEmail);
  const row = {
    userEmail,
    googleEmail: profile.email,
    accessTokenCipher: await encrypt(token.access_token),
    refreshTokenCipher: token.refresh_token ? await encrypt(token.refresh_token) : existing?.refreshTokenCipher ?? null,
    expiresAt: Date.now() + token.expires_in * 1000,
    scope: token.scope ?? existing?.scope ?? "",
    lastSyncAt: existing?.lastSyncAt ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await getDb().insert(googleConnections).values(row).onConflictDoUpdate({ target: googleConnections.userEmail, set: row });
  await refreshCalendarList(userEmail);
}

export async function getValidAccessToken(userEmail: string) {
  const connection = await getGoogleConnection(userEmail);
  if (!connection) throw new Error("GOOGLE_NOT_CONNECTED");
  if (connection.expiresAt > Date.now() + 60_000) return decrypt(connection.accessTokenCipher);
  if (!connection.refreshTokenCipher) throw new Error("GOOGLE_RECONNECT_REQUIRED");

  const { clientId, clientSecret } = getGoogleConfig();
  const refreshToken = await decrypt(connection.refreshTokenCipher);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!response.ok) throw new Error("GOOGLE_RECONNECT_REQUIRED");
  const token = (await response.json()) as TokenResponse;
  await getDb().update(googleConnections).set({ accessTokenCipher: await encrypt(token.access_token), expiresAt: Date.now() + token.expires_in * 1000, updatedAt: nowIso() }).where(eq(googleConnections.userEmail, userEmail));
  return token.access_token;
}

export async function refreshCalendarList(userEmail: string) {
  const accessToken = await getValidAccessToken(userEmail);
  const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("GOOGLE_CALENDAR_LIST_FAILED");
  const data = (await response.json()) as { items?: GoogleCalendarItem[] };
  const now = nowIso();
  const existing = await getDb().select().from(googleCalendars).where(eq(googleCalendars.userEmail, userEmail));
  const selectedById = new Map(existing.map((item) => [item.calendarId, item.selected]));
  for (const item of data.items ?? []) {
    const row = {
      id: `${userEmail}:${item.id}`,
      userEmail,
      calendarId: item.id,
      name: item.summary ?? item.id,
      color: item.backgroundColor ?? "#159AA9",
      selected: selectedById.get(item.id) ?? Boolean(item.primary),
      writable: item.accessRole === "owner" || item.accessRole === "writer",
      isPrimary: Boolean(item.primary),
      updatedAt: now,
    };
    await getDb().insert(googleCalendars).values(row).onConflictDoUpdate({ target: googleCalendars.id, set: row });
  }
}

export async function syncGoogleCalendars(userEmail: string) {
  const accessToken = await getValidAccessToken(userEmail);
  const calendars = await getSelectedGoogleCalendars(userEmail);
  const db = getDb();
  let imported = 0;
  let exported = 0;
  const timeMin = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const timeMax = new Date(Date.now() + 365 * 86_400_000).toISOString();

  for (const calendar of calendars) {
    const params = new URLSearchParams({ singleEvents: "true", orderBy: "startTime", timeMin, timeMax, maxResults: "500" });
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.calendarId)}/events?${params}`, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error("GOOGLE_SYNC_PULL_FAILED");
    const payload = (await response.json()) as { items?: GoogleEvent[] };
    for (const item of payload.items ?? []) {
      if (!item.id || item.status === "cancelled") continue;
      const startAt = item.start?.dateTime ?? (item.start?.date ? `${item.start.date}T00:00:00.000Z` : null);
      const endAt = item.end?.dateTime ?? (item.end?.date ? `${item.end.date}T00:00:00.000Z` : null);
      if (!startAt || !endAt) continue;
      const existing = await db.select().from(events).where(and(eq(events.externalCalendarId, calendar.calendarId), eq(events.externalId, item.id))).limit(1);
      const now = nowIso();
      const row = {
        id: existing[0]?.id ?? crypto.randomUUID(),
        title: item.summary || "未命名日程",
        startAt,
        endAt,
        allDay: Boolean(item.start?.date),
        notes: item.description ?? "",
        color: calendar.color,
        source: "google",
        externalId: item.id,
        externalCalendarId: calendar.calendarId,
        syncStatus: "synced",
        projectId: null,
        archivedAt: null,
        createdAt: existing[0]?.createdAt ?? now,
        updatedAt: item.updated ?? now,
      };
      await db.insert(events).values(row).onConflictDoUpdate({ target: events.id, set: row });
      imported += 1;
    }
  }

  const pending = await db.select().from(events).where(eq(events.syncStatus, "pending"));
  const writeCalendar = calendars.find((calendar) => calendar.writable && calendar.isPrimary) ?? calendars.find((calendar) => calendar.writable);
  if (writeCalendar) {
    for (const item of pending) {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(writeCalendar.calendarId)}/events`, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          summary: item.title,
          description: item.notes,
          start: item.allDay ? { date: item.startAt.slice(0, 10) } : { dateTime: item.startAt },
          end: item.allDay ? { date: item.endAt.slice(0, 10) } : { dateTime: item.endAt },
        }),
      });
      if (!response.ok) continue;
      const remote = (await response.json()) as GoogleEvent;
      await db.update(events).set({ source: "google", externalId: remote.id, externalCalendarId: writeCalendar.calendarId, syncStatus: "synced", updatedAt: remote.updated ?? nowIso() }).where(eq(events.id, item.id));
      exported += 1;
    }
  }
  await db.update(googleConnections).set({ lastSyncAt: nowIso(), updatedAt: nowIso() }).where(eq(googleConnections.userEmail, userEmail));
  return { imported, exported, calendars: calendars.length };
}

export async function setCalendarSelected(userEmail: string, calendarId: string, selected: boolean) {
  await ensureWorkspaceSchema();
  await getDb().update(googleCalendars).set({ selected, updatedAt: nowIso() }).where(and(eq(googleCalendars.userEmail, userEmail), eq(googleCalendars.calendarId, calendarId)));
}

export async function disconnectGoogle(userEmail: string) {
  await ensureWorkspaceSchema();
  await getDb().delete(googleCalendars).where(eq(googleCalendars.userEmail, userEmail));
  await getDb().delete(googleConnections).where(eq(googleConnections.userEmail, userEmail));
}

async function encrypt(value: string) {
  const { encryptionKey } = getGoogleConfig();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(encryptionKey);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipher))}`;
}

async function decrypt(value: string) {
  const { encryptionKey } = getGoogleConfig();
  const [ivValue, cipherValue] = value.split(".");
  if (!ivValue || !cipherValue) throw new Error("TOKEN_DECRYPT_FAILED");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(ivValue) }, await aesKey(encryptionKey), base64ToBytes(cipherValue));
  return new TextDecoder().decode(plain);
}

async function aesKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return encodeBytesBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  bytes.forEach((byte) => (value += String.fromCharCode(byte)));
  return btoa(value);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function encodeBase64Url(value: string) {
  return encodeBytesBase64Url(new TextEncoder().encode(value));
}

function encodeBytesBase64Url(value: Uint8Array) {
  return bytesToBase64(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  return new TextDecoder().decode(base64ToBytes(padded));
}
