// End-to-end: mock MCP server -> real Postgres -> HTTP API  (OM module)
//
// Expected values worked out by hand from mock/mockData.js:
//
// T778O: O, S, C (std=3); 9A, 9Z (custom=2) -> total 5
// T778V: 002, 003, A01 (std=3); Z01, 950 (custom=2) -> total 5
// T778A: O-S-P, SBES (std=2); ZOM_PATH (custom=1) -> total 3
// HRP1000 + T778P:
//   "01": "Current plan" -> 3 objects
//   "02": "Version 02"   -> 1 object
// HRP1001 + T778P:
//   "01": "Current plan" -> 2 relationships
//   "02": "Version 02"   -> 2 relationships
// T77PQ + T77UA:
//   T77PQ distinct profiles: ALL, HR_MGR, FIN_VIEW (total 3)
//   Assigned in T77UA: ALL, HR_MGR (2)
//   Unassigned in T77UA: FIN_VIEW (1)
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
process.env.SAP_PAGE_SIZE = "5";

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

before(async () => {
  await runMigrations();
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await runMigrations();

  httpServer = http.createServer(createApp());
  await new Promise((r) => httpServer.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  await new Promise((r) => httpServer.close(r));
  await mock.close();
  await closePool();
});

test("om: first read triggers live SAP fetch and returns object types summary", async () => {
  const { status, body } = await get("/api/om/object-types");
  assert.equal(status, 200);

  const { data, meta } = body;
  assert.equal(meta.stale, false);
  assert.ok(meta.lastSyncedAt);

  assert.equal(data.stdOmObjects, 3);
  assert.equal(data.customOmObjects, 2);
  assert.equal(data.total, 5);
});

test("om: relationships summary separates std vs custom (starts with Z or 900-999)", async () => {
  const { status, body } = await get("/api/om/relationships");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.stdOmRelationships, 3);
  assert.equal(data.customOmRelationships, 2);
  assert.equal(data.total, 5);
});

test("om: evaluation paths summary separates std vs custom (starts with Z)", async () => {
  const { status, body } = await get("/api/om/evaluation-paths");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.stdOmEvaluationPaths, 2);
  assert.equal(data.customOmEvaluationPaths, 1);
  assert.equal(data.total, 3);
});

test("om: objects per plan version aggregates HRP1000 and maps T778P PTEXT", async () => {
  const { status, body } = await get("/api/om/objects-per-plan-version");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 2);
  const byPlvar = Object.fromEntries(data.items.map((i) => [i.plvar, i]));
  assert.deepEqual(byPlvar["01"], {
    plvar: "01",
    ptext: "Current plan",
    noOfObjects: 3,
  });
  assert.deepEqual(byPlvar["02"], {
    plvar: "02",
    ptext: "Version 02",
    noOfObjects: 1,
  });
});

test("om: relationships per plan version aggregates HRP1001 and maps T778P PTEXT", async () => {
  const { status, body } = await get("/api/om/relationships-per-plan-version");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 2);
  const byPlvar = Object.fromEntries(data.items.map((i) => [i.plvar, i]));
  assert.deepEqual(byPlvar["01"], {
    plvar: "01",
    ptext: "Current plan",
    noOfRelationships: 2,
  });
  assert.deepEqual(byPlvar["02"], {
    plvar: "02",
    ptext: "Version 02",
    noOfRelationships: 2,
  });
});

test("om: auth profiles summary checks T77PQ profiles in T77UA", async () => {
  const { status, body } = await get("/api/om/auth-profiles");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.assignedAuthProfiles, 2);
  assert.equal(data.unassignedAuthProfiles, 1);
  assert.equal(data.total, 3);
});

