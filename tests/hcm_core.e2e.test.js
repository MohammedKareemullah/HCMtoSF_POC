// End-to-end: mock MCP server -> real Postgres -> HTTP API  (hcm_core module)
//
// Expected values worked out by hand from mock/mockData.js additions:
//
// T582A distinct infotypes: 0000, 0001, 0002, 0007, 0008 (PA=5), 1000, 1001 (OM=2), 2001 (TM=1), 9000 (Custom=1) -> total 9
// T591A subtypes per infotype (distinct SUBTY):
//   0000->1  0001->2  0007->3  0008->1  1000->2  9000->1   (0002 not in T591A -> 0 subtypes, omitted from results)
// T582S texts (EN only):
//   0000->"Actions"  0001->"Organizational Assignment"  0002->"Personal Data"
//   0007->"Planned Working Time"  0008->null (no EN row)
//   1000->"Object"  1001->"Relationships"  2001->"Absences"  9000->"Custom Infotype 9000"
//
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/hr_kpi_test";
const SECRET = "mock-secret";

// Must be set BEFORE the app modules are imported (they read env once at load).
process.env.DATABASE_URL = TEST_DB_URL;
process.env.MCP_JWT_SECRET = SECRET;
process.env.SAP_USER = "TESTER";
process.env.SAP_PAGE_SIZE = "5"; // force paging

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
  await new Promise((r) => httpServer.close(r));
  await mock.close();
  await closePool();
});

test("hcm_core: first read triggers a live SAP fetch and returns infotype-category summary", async () => {
  const { status, body } = await get("/api/hcm-core/infotype-categories");
  assert.equal(status, 200);

  const { data, meta } = body;
  assert.equal(meta.stale, false);
  assert.ok(meta.lastSyncedAt);

  // 9 distinct infotypes total
  assert.equal(data.total, 9);

  const byCategory = Object.fromEntries(data.items.map((i) => [i.category, i.infotypeCount]));
  assert.equal(byCategory["Personnel Administration (PA)"], 5);
  assert.equal(byCategory["Organizational Management (OM)"], 2);
  assert.equal(byCategory["Time Management (TM)"], 1);
  assert.equal(byCategory["Custom Infotypes"], 1);
  // Ranges that have no infotypes should still appear with 0
  assert.equal(byCategory["SAP Reserved"], 0);
  assert.equal(byCategory["Recruitment"], 0);
  assert.equal(byCategory["E-Recruiting & Learning"], 0);
});

test("hcm_core: later reads come from Postgres without touching SAP again", async () => {
  const before = mock.calls.length;
  await get("/api/hcm-core/subtypes-per-infotype");
  await get("/api/hcm-core/infotype-detail");
  assert.equal(mock.calls.length, before);
});

test("hcm_core: subtypes per infotype counts distinct subtypes correctly", async () => {
  const { body } = await get("/api/hcm-core/subtypes-per-infotype");
  const { data } = body;

  // 0002 has no subtypes -> should not appear
  assert.ok(!data.items.some((i) => i.infotype === "0002"));

  const byInfotype = Object.fromEntries(data.items.map((i) => [i.infotype, i.subtypeCount]));
  assert.equal(byInfotype["0000"], 1);
  assert.equal(byInfotype["0001"], 2); // duplicate subtype in mock must be deduped
  assert.equal(byInfotype["0007"], 3);
  assert.equal(byInfotype["0008"], 1);
  assert.equal(byInfotype["1000"], 2);
  assert.equal(byInfotype["9000"], 1);

  // categories should be attached
  const omo = data.items.find((i) => i.infotype === "1000");
  assert.equal(omo.category, "Organizational Management (OM)");

  // totals
  assert.equal(data.total, 6); // 6 infotypes with at least one subtype
  assert.equal(data.totalSubtypes, 1 + 2 + 3 + 1 + 2 + 1); // 10
});

test("hcm_core: infotype-detail table includes category and EN text; null for missing EN text", async () => {
  const { body } = await get("/api/hcm-core/infotype-detail");
  const { data } = body;

  // 0001 has 2 distinct subtypes -> 2 rows; 0007 -> 3 rows; total rows = 1+2+3+1+2+1 = 10
  assert.equal(data.total, 10);

  // spot-check: 0001/02 row
  const r0001 = data.items.find((r) => r.infotype === "0001" && r.subtype === "02");
  assert.ok(r0001, "0001/02 row must exist");
  assert.equal(r0001.category, "Personnel Administration (PA)");
  assert.equal(r0001.infotypeText, "Organizational Assignment");

  // 0008 has no EN text -> itext must be null
  const r0008 = data.items.find((r) => r.infotype === "0008");
  assert.ok(r0008, "0008 row must exist");
  assert.equal(r0008.infotypeText, null);

  // 9000 -> Custom category
  const r9000 = data.items.find((r) => r.infotype === "9000");
  assert.ok(r9000);
  assert.equal(r9000.category, "Custom Infotypes");
  assert.equal(r9000.infotypeText, "Custom Infotype 9000");
});

test("hcm_core: POST /sync re-fetches from SAP and reports row counts", async () => {
  const beforeLen = mock.calls.length;
  const { status, body } = await post("/api/hcm-core/sync");
  assert.equal(status, 200);
  assert.equal(body.data.status, "success");
  // t777d has 10 raw rows (incl. 1 duplicate), t591a has 10 rows (incl. 1 dup subtype), t582s has 10 rows
  assert.deepEqual(body.data.rowCounts, { t777d: 10, t591a: 10, t582s: 10 });
  assert.ok(mock.calls.length > beforeLen);
});

test("hcm_core: when SAP is down sync fails with 502, previous data keeps being served", async () => {
  mock.setFailing(true);
  const failed = await post("/api/hcm-core/sync");
  assert.equal(failed.status, 502);
  assert.equal(failed.body.error.code, "MCP_ERROR");
  mock.setFailing(false);

  // data from the last good sync is still there
  const { body } = await get("/api/hcm-core/infotype-categories");
  assert.equal(body.data.total, 9);

  const statusRes = await get("/api/hcm-core/sync/status");
  assert.equal(statusRes.body.data.latestRun.status, "failed");
  assert.equal(statusRes.body.data.lastSuccess.status, "success");
});

