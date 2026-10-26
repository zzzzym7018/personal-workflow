import { callMcpTool, mcpToolDefinitions } from "../lib/mcp-tools";

const PROTOCOL_VERSION = "2026-07-28";

type JsonRpcId = string | number | null;
type JsonObject = Record<string, unknown>;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonRpcError(null, -32700, "JSON 解析失败。", 400);
  }

  if (!isObject(payload) || payload.jsonrpc !== "2.0" || typeof payload.method !== "string") {
    return jsonRpcError(readId(payload), -32600, "JSON-RPC 请求无效。", 400);
  }

  const id = readId(payload);
  const params = isObject(payload.params) ? payload.params : {};

  try {
    switch (payload.method) {
      case "server/discover":
        return jsonRpcResult(id, {
          supportedVersions: [PROTOCOL_VERSION],
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "personal-workflow", version: "1.0.0" },
          instructions: "这是 Personal Workflow 的私人只读工具。优先使用筛选工具，只有整体分析时才读取完整快照。",
        });
      case "initialize":
        return jsonRpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "personal-workflow", version: "1.0.0" },
          instructions: "这是 Personal Workflow 的私人只读工具。优先使用筛选工具，只有整体分析时才读取完整快照。",
        });
      case "notifications/initialized":
        return new Response(null, { status: 204 });
      case "ping":
        return jsonRpcResult(id, {});
      case "tools/list":
        return jsonRpcResult(id, { tools: mcpToolDefinitions });
      case "tools/call":
        return callTool(id, params);
      default:
        return jsonRpcError(id, -32601, `不支持的方法：${payload.method}`);
    }
  } catch (error) {
    return jsonRpcError(id, -32603, errorMessage(error));
  }
}

async function callTool(id: JsonRpcId, params: JsonObject) {
  const name = typeof params.name === "string" ? params.name : "";
  if (!name) return jsonRpcError(id, -32602, "缺少工具名称。");

  try {
    const data = await callMcpTool(name, params.arguments);
    return jsonRpcResult(id, {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: data,
      isError: false,
    });
  } catch (error) {
    return jsonRpcResult(id, {
      content: [{ type: "text", text: errorMessage(error) }],
      isError: true,
    });
  }
}

function jsonRpcResult(id: JsonRpcId, result: unknown) {
  return Response.json(
    { jsonrpc: "2.0", id, result },
    { headers: { "cache-control": "private, no-store" } },
  );
}

function jsonRpcError(id: JsonRpcId, code: number, message: string, status = 200) {
  return Response.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status, headers: { "cache-control": "private, no-store" } },
  );
}

function readId(value: unknown): JsonRpcId {
  if (!isObject(value)) return null;
  return typeof value.id === "string" || typeof value.id === "number" || value.id === null
    ? value.id
    : null;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "工具调用失败。";
}
