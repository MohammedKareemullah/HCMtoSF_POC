// End-to-end: mock MCP server (sap_function_call RFC_GET_SYSTEM_INFO) -> Postgres -> HTTP API (Header module)
//
// Expected values worked out by hand from mock/mockData.js (MOCK_FUNCTIONS.RFC_GET_SYSTEM_INFO):
//   RFCSI_EXPORT.RFCSYSID -> systemName: "S4H"
//   RFCSI_EXPORT.RFCOPSYS -> operatingSystem: "Linux"
//   RFCSI_EXPORT.RFCDBSYS -> databaseSystem: "HDB"
//   RFCSI_EXPORT.RFCDEST  -> logicalDestination: "S4HCLNT100"
//
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/hr_kpi_test";
const SECRET = "mock-secret";

process.env.DATABASE_URL = TEST_DB_URL;
process.env.MCP_JWT_SECRET = SECRET;
process.env.SAP_USER = "TESTER";

const { startMockMcp } = await import("../mock/mockMcpServer.js");
const mock = await startMockMcp({ secret: SECRET });
process.env.MCP_URL = mock.url;

const { pool, closePool } = await import("../src/config/db.js");
const { runMigrations } = await import("../src/db/migrate.js");
const { createApp } = await import("../src/app.js");

let httpServer;
let base;

const get = async (path) => {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
};

const post = async (path) => {
  const res = await fetch(base + path, { method: "POST" });
  return { status: res.status, body: await res.json() };
};

before(async () => {
  await runMigrations();
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await runMigrations();

  httpServer = http.createServer(createApp());
  await new Promise((r) => httpServer.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  if (httpServer) await new Promise((r) => httpServer.close(r));
  await mock.close();
  await closePool();
});

test("first read invokes RFC_GET_SYSTEM_INFO with { DESTINATION: '' } and returns RFCSI_EXPORT fields", async () => {
  assert.equal(mock.calls.length, 0);

  const res = await get("/api/header/system-info");
  assert.equal(res.status, 200);
  assert.equal(res.body.meta.stale, false);
  assert.deepEqual(res.body.data, {
    systemName: "S4H",
    operatingSystem: "Linux",
    databaseSystem: "HDB",
    logicalDestination: "S4HCLNT100",
  });

  const fnCalls = mock.calls.filter((c) => c.tool === "sap_function_call");
  assert.equal(fnCalls.length, 1);
  assert.equal(fnCalls[0].functionName, "RFC_GET_SYSTEM_INFO");
  assert.deepEqual(fnCalls[0].parameters, { DESTINATION: "" });
});

test("subsequent reads serve from PostgreSQL without calling MCP; ?refresh=true and POST /sync re-fetch", async () => {
  const beforeCalls = mock.calls.length;
  const cached = await get("/api/header");
  assert.equal(cached.status, 200);
  assert.equal(mock.calls.length, beforeCalls);

  const refreshed = await get("/api/header/system-info?refresh=true");
  assert.equal(refreshed.status, 200);
  assert.equal(mock.calls.length, beforeCalls + 1);

  const synced = await post("/api/header/sync");
  assert.equal(synced.status, 200);
  assert.equal(synced.body.data.status, "success");
  assert.equal(synced.body.data.rowCounts.system_info, 1);
  assert.equal(mock.calls.length, beforeCalls + 2);
});
