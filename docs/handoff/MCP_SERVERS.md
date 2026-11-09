# MCP Servers

> **Read this first.** No MCP server was *created* in this project's real deployment. The project is an **MCP client** of a server the owner
> already has (the "Hypercare MCP server"). The only MCP server implemented in this repository is a **mock** used for development and tests.
> Almost everything about the real server's internals is **UNKNOWN**; its source code was never shown. What follows separates
> evidence (the owner's Python script) from inference and from the mock.

## 1. Inventory

| # | Server | In repo? | Created by us? | Purpose |
|---|---|---|---|---|
| A | **Hypercare MCP server** (URL path `/hypercare-mcp`) | No | No (owner's) | Exposes SAP read tools (tables, RFC functions, KPIs, locks, IDocs, jobs, metadata). The real data source |
| B | **Mock MCP server** (`mock/mockMcpServer.js`) | Yes | Yes | Stand-in for A with a synthetic dataset, for `npm run mock:mcp` and the e2e tests |

There is no other MCP server, no MCP resources and no MCP prompts implemented or consumed anywhere in this repo.
(The assistant's own session had unrelated connectors, e.g. memory and document tools; they are not part of this project.)

---

## 2. Server A: Hypercare MCP server (external)

### 2.1 What is known (evidence: `reference/hypercare_mcp_test_script.py`)

| Aspect | Value | Confidence |
|---|---|---|
| Default URL | `https://localhost:8000/hypercare-mcp` (script default; owner's real `MCP_URL` is in their `.env`, UNKNOWN) | Evidence |
| Transport | HTTP `POST` to a single URL, JSON-RPC 2.0 body, `Accept: application/json, text/event-stream`. Responses are **either** plain JSON **or** an SSE stream (`text/event-stream`) whose last `data:` event is the JSON-RPC response (Streamable-HTTP style) | Evidence (the script handles both) |
| Auth | `Authorization: Bearer <JWT>`; HS256; header `{"alg":"HS256","typ":"JWT"}`; payload `{ "sap": { ashost, sysnr, client, user, passwd, lang, [http: {baseUrl, client, user, passwd}] }, "exp": <unix seconds> }`; signed with a shared secret (`MCP_JWT_SECRET`) | Evidence |
| JWT `exp` | Script uses `9999999999` (effectively never). The Node client uses now + `MCP_TOKEN_TTL_SECONDS` (3600) and renews. Whether the server rejects short-lived tokens: UNKNOWN (should be fine) | Evidence / inference |
| Methods used | Only `tools/call`. The script never calls `initialize`, `tools/list`, `resources/*`, `prompts/*`, and sends no `Mcp-Session-Id` | Evidence |
| Request timeout | Script: 180 s. Node client: `MCP_TIMEOUT_MS` (default 180000) | Evidence |
| Config location hint | The script looks for `mcp-server/.env.local`, `mcp-server/.env`, `mcp-server/.env.example` next to itself → the server project is probably a sibling `mcp-server/` folder on the owner's machine | Inference |
| SAP side | Fields `ashost`/`sysnr` imply RFC-style connectivity; optional `http.baseUrl` implies an HTTP (e.g. OData/ADT) channel; tool names `ZHC_*` (e.g. `ZHC_GET_DATA_QUALITY_KPIS`) imply custom ABAP function modules | Inference |

### 2.2 Tool catalog (names and sample arguments from the Python script)

Descriptions, full input schemas and output formats of **every** tool are **UNKNOWN** (no `tools/list` was ever called; no server source seen).
"Sample arguments" are exactly what the owner's script sends; they show valid argument names, not complete schemas.

| Tool | Sample arguments (from script) | Used by this backend? |
|---|---|---|
| `sap_connection_check` | `{}` | Wrapper exists (`sapTools.js`), **not called** by the backend |
| `sap_table_read` | `{ table: "PA0001", fields: ["PERNR","GSBER","BTRTL"], rowCount: 5, delimiter: "\|" }` | **YES, the only tool the backend uses** |
| `sap_function_call` | `{ functionName: "RFC_SYSTEM_INFO", parameters: {} }` | Wrapper only, not called |
| `sap_lock_entries` | `{ functionName: "ENQUEUE_READ" }` | Wrapper only, not called |
| `sap_wrapper_catalog` | `{}` | No |
| `sap_wrapper_probe` | `{ functionName: "ZHC_GET_DATA_QUALITY_KPIS" }` | No |
| `sap_kpi_catalog` | `{}` | No |
| `sap_kpi_read` | `{ kpiIds: ["active_user_count","failed_login_attempts"], from: <ISO8601>, to: <ISO8601>, sapFlavor: "shared" }` | No (possible future alternative to raw table reads; coverage UNKNOWN) |
| `sap_sod_table_probe` | `{}` | No |
| `sap_sod_table_batch_read` | `{ table: "USR02", fields: ["BNAME","USTYP"], rowCount: 10, rowSkips: 0 }` | No (the only place the script shows `rowSkips`) |
| `sap_job_log_read` | `{ jobName: "SAP_REORG_JOBS", jobCount: "1" }` | No |
| `sap_idoc_detail` | `{ docNum: "0000000000000001" }` | No |
| `sap_metadata_introspect` | `{ objectType: "table", objectName: "USR02" }` | No |
| `sap_health_snapshot` | `{}` | No |
| `sap_repository_discovery` | `{ mode: "packages", pattern: "Z*" }` | No |

Resources: UNKNOWN (none requested). Prompts: UNKNOWN (none requested). Internal implementation of every tool: UNKNOWN.

### 2.3 `sap_table_read`, what the backend assumes

| Item | Value | Basis |
|---|---|---|
| Arguments sent | `table` (SAP table name), `fields` (array of SAP field names), `rowCount` (page size), `delimiter` (`"\|"`), `rowSkips` (offset) | `table/fields/rowCount/delimiter` from the script; **`rowSkips` is an assumption** (script shows it only on `sap_sod_table_batch_read`) |
| Response | **UNKNOWN. Never seen.** The client accepts several plausible shapes (section 4.4) and throws on anything else | Assumption, mitigated |
| Row format | Assumed `"v1\|v2\|..."` strings (values possibly space-padded) or objects keyed by field | Assumption |
| Max rows per call | UNKNOWN. The reader advances by the number of rows actually returned, so a server-side cap is tolerated | Defensive design |
| Date format | Assumed `YYYYMMDD` (standard SAP internal format); converted by `sapDate` | Assumption |

**First task on the real system:** `npm run inspect:table -- PA0000 PERNR,STAT2 5` (prints raw response + normalised rows), then confirm that
paging with `rowSkips` actually advances (see SETUP_AND_EXECUTION.md section 8).

### 2.4 How to start / test / debug Server A

- **Start:** UNKNOWN (not our code). The owner runs it themselves.
- **Test all tools:** the owner's script, `python hypercare_mcp_test_script.py [--url URL] [--secret SECRET] [--tool TOOL_NAME]` (flags: `--url`, `--secret`, `--tool`, `--output`).
  Quirk: the script **always** overwrites `args.output` with `"test_results.json"` and writes `{ tool: {status, data|error} }` there.
- **Test from Node:** `npm run inspect:table -- <TABLE> <F1,F2> [rowCount]`, or `npm start` and call `POST /api/headcount/sync`.
- **Debug:** a non-2xx HTTP status is reported as `MCP HTTP <status> calling <tool>: <body (500 chars)>`. HTTP 401 usually means a JWT secret mismatch. TLS errors on a self-signed
  `https://localhost` are reported as `MCP request <tool> failed: fetch failed (<CODE>)`; for development only, run Node with `NODE_TLS_REJECT_UNAUTHORIZED=0`.

---

## 3. How Claude was configured to discover and invoke these tools

**It was not.** Precisely:

- The Node app is the MCP client. It does **not** use an LLM at runtime, does not call `tools/list`, and has hard-coded tool names/arguments.
- No Claude MCP configuration exists in the repo (no `.mcp.json`, no `claude_desktop_config.json`; verified by search). No MCP SDK is a dependency.
- During development the assistant never connected to the real MCP server; its sandbox could not reach the owner's endpoint. Everything was verified
  against the mock (Server B). The assistant derived the protocol purely from the owner's Python script.
- If a future agent wants Claude (or another MCP-capable agent) to use the Hypercare server directly, register the server URL in that agent's MCP config
  with `Authorization: Bearer <JWT>` (the JWT must be minted as in `src/integrations/mcp/mcpClient.js`, so a static header would need a long-lived token like the Python script's). This
  has **not** been tried; treat it as an idea, not a documented procedure.

---

## 4. The MCP client (implemented: `src/integrations/mcp/`)

### 4.1 `mcpClient.js`

- `getToken()`: builds `{ sap: env.sap, exp: now + MCP_TOKEN_TTL_SECONDS }`, signs HS256 with `crypto.createHmac`, base64url-encodes (no JWT library). Cached in module scope; reused until 60 s before expiry.
  `env.sap` = `SAP_ASHOST, SAP_SYSNR, SAP_CLIENT, SAP_USER, SAP_PASSWD, SAP_LANG` (+ `http: { baseUrl, client, user, passwd }` only when `SAP_HTTP_BASE_URL` is set).
- `callTool(name, args)`: `POST MCP_URL`, headers `Authorization: Bearer ...`, `Content-Type: application/json`, `Accept: application/json, text/event-stream`;
  body `{ jsonrpc: "2.0", id: <uuid>, method: "tools/call", params: { name, arguments } }`; `AbortController` timeout.
- Response parsing: if `content-type` contains `text/event-stream`, collect `data:` lines per event (blank line terminates), `JSON.parse` each, use the **last** event; otherwise `JSON.parse` the body.
- Unwrapping (`unwrapResult`): JSON-RPC `error` → `McpError`; `result.isError` → `McpError("Tool <name> failed: <text>")`; otherwise join all `result.content[]` blocks of `type:"text"` with `\n`, try `JSON.parse`, else return the raw string;
  if there is no text, return `result.structuredContent ?? result`.
- All failures become `McpError` (HTTP 502 to API callers, code `MCP_ERROR`): non-2xx HTTP, unreadable body, JSON-RPC error, tool error, timeout (`MCP request <tool> timed out after <ms>ms`), network error.

### 4.2 `sapTools.js`: thin wrappers

`sapConnectionCheck()`, `sapTableRead({table, fields, rowCount=5, delimiter="|", ...rest})` (validates table/fields), `sapFunctionCall(functionName, parameters={})`,
`sapLockEntries({functionName="ENQUEUE_READ", ...rest})`. Only `sapTableRead` is used by the backend (via `sapTableReader.js` and `scripts/inspect-table.js`).

### 4.3 `sapTableReader.js`: paging

`readSapTable({ table, fields, pageSize=5000, maxPages=2000 })` loops: call `sap_table_read` with `rowCount=pageSize`, `rowSkips=<rows so far>`; normalise; stop at the first **empty** page
(so it always makes one extra call; 16 rows at page size 7 → calls at skips 0, 7, 14, 16). It advances by rows actually returned. Safeguards:

- identical first/last/count fingerprint as page 0 on a later page → `McpError` "server seems to ignore rowSkips" (set `SAP_PAGE_SIZE` above the table's row count to read it in one call);
- more than `maxPages` pages → `McpError` (raise `SAP_MAX_PAGES` or `SAP_PAGE_SIZE`).

### 4.4 `normalizeTableRows(result, fields, delimiter)`: accepted response shapes

Row **container** (first match wins): the result itself if an array; a string split into lines; an object whose key is one of `rows, data, records, items, lines, DATA, ET_DATA, result` (arrays, line-split strings for `rows/data/lines/DATA`, or nested objects searched recursively);
or an object with exactly one array-valued property. A first line equal to the requested field names (case-insensitive) is dropped as a header.
Row **item**: a `"a|b|c"` string; an array of values; an object keyed by field (case-insensitive); or an object `{ WA: "a|b|c" }` (RFC_READ_TABLE style).
Values are trimmed. A column-count mismatch (e.g. a value containing `|`) throws. Anything else throws `Unrecognised sap_table_read response (...)`.
Unit tests cover each accepted shape and the failures (`tests/unit.test.js`).

### 4.5 Tables and fields requested by the headcount module (`headcount.constants.js`)

| SAP table | Fields requested (in order) | Staging table |
|---|---|---|
| `PA0000` | `PERNR, BEGDA, ENDDA, MASSN, STAT2` | `hc_pa0000` |
| `PA0001` | `PERNR, BEGDA, ENDDA, BUKRS, WERKS, PERSG, PERSK, ABKRS` | `hc_pa0001` |
| `T500P` | `PERSA, LAND1` | `hc_t500p` |
| `T001` | `BUKRS, BUTXT` | `hc_t001` |
| `HRPY_RGDIR` | `PERNR, ABKRS, FPPER, SRTZA` | `hc_hrpy_rgdir` |

Tables are fetched with concurrency `SAP_FETCH_CONCURRENCY` (default 2); each table is read fully into memory before loading.

---

## 5. Server B: Mock MCP server (implemented, in repo)

**Purpose:** let the whole stack run and be tested without SAP. **Not** a faithful emulation of the real server; its response shape is the *author's guess*.

- **Files:** `mock/mockMcpServer.js` (`startMockMcp({ secret=<dummy default>, port=0 })`), `mock/mockData.js` (dataset), `mock/runMockMcp.js` (CLI runner).
- **Transport:** plain `http` server on `127.0.0.1`, any path, JSON-RPC `POST`. Returns JSON, **except** requests for table `T001`, which are answered as SSE (`event: message\ndata: {...}\n\n`) to exercise the client's SSE path.
- **Auth:** verifies the HS256 signature (timing-safe), `exp`, and presence of `sap.user`; otherwise HTTP 401 `{"error":"unauthorized: <reason>"}`. The default secret is a dummy value (printed when you start the runner); set the same value as `MCP_JWT_SECRET`.
- **Tools implemented:** `sap_connection_check` → `{"connected":true}` as a text content block; `sap_table_read` → `{ table, fields, rowCount, rows: ["<v1 padded to 10>|<v2 padded>|..."] }` as JSON text; supports `rowCount` + `rowSkips`; unknown table/field/tool → `result.isError=true` with a message.
  All other tools return an error "Unknown tool".
- **Failure injection:** `setFailing(true)` makes every request return HTTP 500 `mock SAP is down` (used by the e2e "SAP down" test). `calls` records `{tool, table, fields, rowCount, rowSkips}` for assertions.
- **Dataset (`mockData.js`)**: tables `PA0000` (16 rows, 12 employees, deliberately unordered, multi-record history, hire/leaver/retiree actions), `PA0001` (13 rows; PERNR 9999 exists *only* here; PERNR 1012 has no row; employee 1002 moved company/plant),
  `T500P` (6 plants; keyed `PERSA`), `T001` (4 companies), `HRPY_RGDIR` (17 rows; months 2024-01/02/03/06, with a gap on purpose and a superseded `P` row). Expected KPI values are documented in the header of `tests/headcount.e2e.test.js`.
- **Start:** `npm run mock:mcp` (port `MOCK_PORT`, default 8000), then in `.env` set `MCP_URL=http://127.0.0.1:8000/hypercare-mcp` and `MCP_JWT_SECRET=<the secret the runner prints>`.
- **Test:** `npm test` (the e2e test starts it on a random port in-process).
- **Debug:** inspect `mock.calls`; change `mockData.js` rows and update the e2e expected values (they are hand-computed).
- **Dependencies:** Node built-ins only (`http`, `crypto`).

## 6. Dependencies and runtime configuration (MCP-related)

Runtime: Node >= 20 (global `fetch`, `AbortController`, `crypto`). No MCP SDK, no JWT library. Variables: `MCP_URL`, `MCP_JWT_SECRET`, `MCP_TOKEN_TTL_SECONDS`, `MCP_TIMEOUT_MS`,
`SAP_ASHOST`, `SAP_SYSNR`, `SAP_CLIENT`, `SAP_USER`, `SAP_PASSWD`, `SAP_LANG`, optional `SAP_HTTP_BASE_URL`, `SAP_HTTP_CLIENT`, `SAP_HTTP_USER`, `SAP_HTTP_PASSWD`;
paging/concurrency: `SAP_PAGE_SIZE`, `SAP_MAX_PAGES`, `SAP_FETCH_CONCURRENCY`. Meanings in [BACKEND_DOCUMENTATION.md](BACKEND_DOCUMENTATION.md) section 7.

## 7. Open MCP questions (UNKNOWN: ask the owner or test on the real system)

1. Exact JSON shape of the `sap_table_read` response (row container, row format, padding, header line, dates).
2. Does `sap_table_read` support `rowSkips`? Is there a maximum `rowCount`? Is there a `where`/filter argument (would allow server-side filtering)?
3. Does the server require `initialize` / a session id for any tool? (The Python script works without, per its design.)
4. Is HTTP 401 the failure code for a bad/expired JWT? Any rate limiting or concurrency limits on the server?
5. Would `sap_kpi_read` / `sap_kpi_catalog` cover any headcount KPI directly (the owner chose raw tables; the alternative was never evaluated)?
6. How is the real server started/deployed, and where is its source?
7. Are values zero-padded as in SAP (e.g. PERNR `00001002`)? The mock assumes so.
