import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { McpError } from "../../shared/errors/AppError.js";

// ---------- JWT (HS256, no external dependency) ----------
const b64url = (input) => Buffer.from(input).toString("base64url");

function signJwt(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

let cachedToken = null;
let cachedExp = 0;

export function getToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedExp - now > 60) return cachedToken; // reuse until 60s before expiry
  cachedExp = now + env.mcp.tokenTtlSeconds;
  cachedToken = signJwt({ sap: env.sap, exp: cachedExp }, env.mcp.jwtSecret);
  return cachedToken;
}

// ---------- Response parsing (plain JSON or SSE) ----------
function parseMcpResponse(text, contentType) {
  if (!contentType.includes("text/event-stream")) return JSON.parse(text);

  const events = [];
  let data = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("data:")) {
      data.push(line.slice(5).trim());
    } else if (!line.trim() && data.length) {
      events.push(JSON.parse(data.join("\n")));
      data = [];
    }
  }
  if (data.length) events.push(JSON.parse(data.join("\n")));
  if (!events.length) throw new McpError("MCP returned SSE without data events");
  return events[events.length - 1];
}

// MCP tool results arrive as result.content[] blocks; unwrap to the JSON the tool produced.
function unwrapResult(rpc, toolName) {
  if (rpc.error) throw new McpError(`MCP error ${rpc.error.code} from ${toolName}: ${rpc.error.message}`);

  const result = rpc.result ?? {};
  const text = (result.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  if (result.isError) throw new McpError(`Tool ${toolName} failed: ${text || "unknown error"}`);

  if (text) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return result.structuredContent ?? result;
}

export async function callTool(name, args = {}) {
  const payload = {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method: "tools/call",
    params: { name, arguments: args },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.mcp.timeoutMs);

  try {
    const res = await fetch(env.mcp.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const raw = await res.text();
    if (!res.ok) throw new McpError(`MCP HTTP ${res.status} calling ${name}: ${raw.slice(0, 500)}`);

    let rpc;
    try {
      rpc = parseMcpResponse(raw, res.headers.get("content-type") ?? "");
    } catch (err) {
      if (err instanceof McpError) throw err;
      throw new McpError(`MCP returned an unreadable response for ${name}: ${err.message}`);
    }
    return unwrapResult(rpc, name);
  } catch (err) {
    if (err instanceof McpError) throw err;
    if (err.name === "AbortError") throw new McpError(`MCP request ${name} timed out after ${env.mcp.timeoutMs}ms`);
    const cause = err.cause?.code ? ` (${err.cause.code})` : "";
    throw new McpError(`MCP request ${name} failed: ${err.message}${cause}`);
  } finally {
    clearTimeout(timer);
  }
}
