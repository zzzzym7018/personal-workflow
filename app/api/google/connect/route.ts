import { accessErrorResponse, requireAllowedViewer } from "../../../lib/server-auth";
import { createOAuthState, getGoogleConfig } from "../../../lib/google-calendar";

export async function GET(request: Request) {
  try {
    const viewer = await requireAllowedViewer();
    const { clientId, allowedGoogleEmail } = getGoogleConfig();
    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/google/callback`;
    const state = await createOAuthState(viewer.email);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      scope: "openid email https://www.googleapis.com/auth/calendar",
      state,
      login_hint: allowedGoogleEmail,
    });
    return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  } catch (error) {
    return accessErrorResponse(error);
  }
}
