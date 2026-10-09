import { accessErrorResponse, requireAllowedViewer } from "../../../lib/server-auth";
import { disconnectGoogle } from "../../../lib/google-calendar";

export async function DELETE() {
  try {
    const viewer = await requireAllowedViewer();
    await disconnectGoogle(viewer.email);
    return Response.json({ disconnected: true });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
