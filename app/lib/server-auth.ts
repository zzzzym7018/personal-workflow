import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { getChatGPTUser, type ChatGPTUser } from "../chatgpt-auth";

export type Viewer = ChatGPTUser & { isPreview: boolean };

type RuntimeEnv = {
  ALLOWED_USER_EMAIL?: string;
};

export class AccessError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function getViewer(): Promise<Viewer | null> {
  const user = await getChatGPTUser();
  if (user) return { ...user, isPreview: false };

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  if (host.startsWith("localhost:") || host.startsWith("127.0.0.1:")) {
    return {
      displayName: "本地预览",
      email: "local-preview@example.com",
      fullName: "本地预览",
      isPreview: true,
    };
  }
  return null;
}

export async function requireAllowedViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AccessError(401, "请先登录后继续。 ");
  if (viewer.isPreview) return viewer;

  const runtimeEnv = env as unknown as RuntimeEnv;
  const allowed = runtimeEnv.ALLOWED_USER_EMAIL?.trim().toLowerCase();
  if (!allowed) {
    throw new AccessError(503, "站点尚未完成私人访问配置。 ");
  }
  if (viewer.email.trim().toLowerCase() !== allowed) {
    throw new AccessError(403, "这个站点只对已配置的私人账号开放。 ");
  }
  return viewer;
}

export function accessErrorResponse(error: unknown): Response {
  if (error instanceof AccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: "请求未能完成，请稍后重试。" }, { status: 500 });
}
