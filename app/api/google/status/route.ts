import { accessErrorResponse, requireAllowedViewer } from "../../../lib/server-auth";
import { getAllGoogleCalendars, getGoogleConnection } from "../../../lib/workspace-db";
import { getGoogleConfig } from "../../../lib/google-calendar";

export async function GET() {
  try {
    const viewer = await requireAllowedViewer();
    let configured = true;
    try { getGoogleConfig(); } catch { configured = false; }
    const connection = await getGoogleConnection(viewer.email);
    const calendars = connection ? await getAllGoogleCalendars(viewer.email) : [];
    return Response.json({ configured, connected: Boolean(connection), googleEmail: connection?.googleEmail ?? null, lastSyncAt: connection?.lastSyncAt ?? null, calendars });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
