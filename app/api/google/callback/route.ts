import { accessErrorResponse, requireAllowedViewer } from "../../../lib/server-auth";
import { exchangeGoogleCode, saveGoogleConnection, verifyOAuthState } from "../../../lib/google-calendar";

export async function GET(request: Request) {
  try {
    const viewer = await requireAllowedViewer();
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return Response.redirect(`${url.origin}/?view=settings&google=cancelled`);
    const stateValue = await verifyOAuthState(state);
    if (stateValue.email.toLowerCase() !== viewer.email.toLowerCase()) throw new Error("OAUTH_USER_MISMATCH");
    const token = await exchangeGoogleCode(code, `${url.origin}/api/google/callback`);
    await saveGoogleConnection(viewer.email, token);
    return Response.redirect(`${url.origin}/?view=settings&google=connected`);
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response.status >= 500) return Response.redirect(`${new URL(request.url).origin}/?view=settings&google=error`);
    return response;
  }
}
