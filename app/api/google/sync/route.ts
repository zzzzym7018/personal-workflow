import { accessErrorResponse, requireAllowedViewer } from "../../../lib/server-auth";
import { syncGoogleCalendars } from "../../../lib/google-calendar";

export async function POST() {
  try {
    const viewer = await requireAllowedViewer();
    const result = await syncGoogleCalendars(viewer.email);
    return Response.json(result);
  } catch (error) {
    return accessErrorResponse(error);
  }
}
