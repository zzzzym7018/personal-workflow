import { accessErrorResponse, requireAllowedViewer } from "../../../lib/server-auth";
import { refreshCalendarList, setCalendarSelected } from "../../../lib/google-calendar";
import { getAllGoogleCalendars } from "../../../lib/workspace-db";

export async function GET() {
  try {
    const viewer = await requireAllowedViewer();
    await refreshCalendarList(viewer.email);
    return Response.json({ calendars: await getAllGoogleCalendars(viewer.email) });
  } catch (error) {
    return accessErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const viewer = await requireAllowedViewer();
    const body = (await request.json()) as { calendarId?: string; selected?: boolean };
    if (!body.calendarId || typeof body.selected !== "boolean") return Response.json({ error: "日历选择无效。" }, { status: 400 });
    await setCalendarSelected(viewer.email, body.calendarId, body.selected);
    return Response.json({ updated: true });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
