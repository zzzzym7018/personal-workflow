import { env } from "cloudflare:workers";
import { getWorkspaceExportSnapshot } from "../../lib/workspace-db";

type ExportEnv = { EXPORT_TOKEN?: string };

function sameToken(received: string, expected: string) {
  if (received.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export async function GET(request: Request) {
  const expected = ((env as unknown as ExportEnv).EXPORT_TOKEN ?? "").trim();
  if (!expected) {
    return Response.json({ error: "导出接口未配置。" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const received = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!sameToken(received, expected)) {
    return Response.json({ error: "未授权。" }, { status: 401 });
  }

  const snapshot = await getWorkspaceExportSnapshot();
  return Response.json(
    { exportedAt: new Date().toISOString(), ...snapshot },
    { headers: { "cache-control": "private, no-store" } },
  );
}
