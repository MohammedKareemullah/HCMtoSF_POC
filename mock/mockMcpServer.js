import http from "node:http";
import crypto from "node:crypto";
import { MOCK_TABLES } from "./mockData.js";

/** Verify an HS256 JWT exactly like a real server would. Returns the payload or throws. */
function verifyJwt(token, secret) {
  const [h, b, sig] = (token ?? "").split(".");
  if (!h || !b || !sig) throw new Error("malformed token");
  const expected = crypto.createHmac("sha256", secret).update(`${h}.${b}`).digest();
  const actual = Buffer.from(sig, "base64url");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) throw new Error("bad signature");
  const payload = JSON.parse(Buffer.from(b, "base64url").toString("utf8"));
  if (payload.exp && payload.exp < Date.now() / 1000) throw new Error("token expired");
  if (!payload.sap?.user) throw new Error("no SAP credentials in token");
  return payload;
}

const textResult = (obj, isError = false) => ({
  content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj) }],
  ...(isError ? { isError: true } : {}),
});

/**
 * A stand-in for the Hypercare MCP server. Implements tools/call for sap_table_read
 * (rowCount + rowSkips paging, '|' delimited fixed-width-ish rows) and sap_connection_check.
 * T001 is answered as an SSE stream to exercise the client's SSE parsing.
 */
export function startMockMcp({ secret = "mock-secret", port = 0 } = {}) {
  const calls = [];
  let failing = false;

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (failing) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        return res.end("mock SAP is down");
      }
      try {
        verifyJwt((req.headers.authorization ?? "").replace(/^Bearer /, ""), secret);
      } catch (err) {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: `unauthorized: ${err.message}` }));
      }

      const rpc = JSON.parse(body);
      const { name, arguments: args = {} } = rpc.params ?? {};
      calls.push({ tool: name, table: args.table, rowCount: args.rowCount, rowSkips: args.rowSkips ?? 0 });

      let result;
      if (name === "sap_connection_check") {
        result = textResult({ connected: true });
      } else if (name === "sap_table_read") {
        const data = MOCK_TABLES[args.table];
        if (!data) {
          result = textResult(`Table ${args.table} not found`, true);
        } else {
          const delimiter = args.delimiter ?? "|";
          const skips = args.rowSkips ?? 0;
          const slice = data.slice(skips, args.rowCount ? skips + args.rowCount : undefined);
          const missing = (args.fields ?? []).find((f) => !(f in (data[0] ?? {})));
          result = missing
            ? textResult(`Field ${missing} not found in ${args.table}`, true)
            : textResult({
                table: args.table,
                fields: args.fields,
                rowCount: slice.length,
                rows: slice.map((r) => args.fields.map((f) => String(r[f]).padEnd(10)).join(delimiter)),
              });
        }
      } else {
        result = textResult(`Unknown tool ${name}`, true);
      }

      const envelope = JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result });
      if (args.table === "T001") {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.end(`event: message\ndata: ${envelope}\n\n`);
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(envelope);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      resolve({
        server,
        url: `http://127.0.0.1:${server.address().port}/hypercare-mcp`,
        calls,
        setFailing: (v) => (failing = v),
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
