// End-to-end: mock MCP server -> real Postgres -> HTTP API  (PA module)
//
// Expected values worked out by hand from mock/mockData.js:
//
// T582A: 7 rows total
//   Single screen (EDYNR):
//     Universal Standard: 1 ("0001" -> 2000)
//     Country Specific:   2 ("0002" -> 2010, "0007" -> 2500)
//     Fast Entry Screens: 1 ("0014" -> 2900)
//     Custom:             2 ("9000" -> 9100, "0100" -> 0100)
//     Others:             1 ("0021" -> 1500)
//   List screen (LDYNR):
//     Universal Standard: 1 ("0001" -> 3000)
//     Country Specific:   3 ("0002" -> 3100, "0007" -> 3200, "0014" -> 3050)
//     Custom:             2 ("9000" -> 9100, "0100" -> 0200)
//     Others:             1 ("0021" -> 4000)
//
// T588M & T777D:
//   Module pools with DYNNR != ADYNR mapped to T777D:
//     "0001" -> MP000100
//     "0002" -> MP000200
//     "0007" -> MP000700
//
// DBILD indicator counts:
//   "0001": hidden=2, displayOnly=2, required=2, optional=6
//   "0002": hidden=2, displayOnly=1, required=1, optional=0
//   "0007": hidden=1, displayOnly=0, required=2, optional=4
//
// T588Z:
//   Dynamic actions per infotype:
//     "0001" -> 5
//     "0002" -> 2
//     "0007" -> 1
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

test("pa: first read triggers live SAP fetch and returns single-screen classification", async () => {
  const { status, body } = await get("/api/pa/single-screen-classification");
  assert.equal(status, 200);

  const { data, meta } = body;
  assert.equal(meta.stale, false);
  assert.ok(meta.lastSyncedAt);

  assert.equal(data.total, 7);
  const byClass = Object.fromEntries(data.summary.map((s) => [s.classification, s.count]));
  assert.equal(byClass["Universal Standard"], 1);
  assert.equal(byClass["Country Specific"], 2);
  assert.equal(byClass["Fast Entry Screens"], 1);
  assert.equal(byClass["Custom"], 2);
  assert.equal(byClass["Others"], 1);
});

test("pa: list-screen classification groups correctly", async () => {
  const { status, body } = await get("/api/pa/list-screen-classification");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 7);
  const byClass = Object.fromEntries(data.summary.map((s) => [s.classification, s.count]));
  assert.equal(byClass["Universal Standard"], 1);
  assert.equal(byClass["Country Specific"], 3);
  assert.equal(byClass["Custom"], 2);
  assert.equal(byClass["Others"], 1);
});

test("pa: module-pool mapping filters DYNNR != ADYNR and maps to T777D", async () => {
  const { status, body } = await get("/api/pa/module-pool-mapping");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 3);
  const pools = data.items.map((i) => `${i.infotype}:${i.modulePool}`).sort();
  assert.deepEqual(pools, ["0001:MP000100", "0002:MP000200", "0007:MP000700"]);
});

test("pa: field visibility summary tallies DBILD symbols correctly", async () => {
  const { status, body } = await get("/api/pa/field-visibility-summary");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 3);
  const byInfty = Object.fromEntries(data.items.map((i) => [i.infotype, i]));
  assert.deepEqual(byInfty["0001"], {
    infotype: "0001",
    hidden: 2,
    displayOnly: 2,
    required: 2,
    optional: 6,
  });
  assert.deepEqual(byInfty["0002"], {
    infotype: "0002",
    hidden: 2,
    displayOnly: 1,
    required: 1,
    optional: 0,
  });
  assert.deepEqual(byInfty["0007"], {
    infotype: "0007",
    hidden: 1,
    displayOnly: 0,
    required: 2,
    optional: 4,
  });
});

test("pa: dynamic-action-count groups by infotype with dynamicActionSeqCount and dynamicCount", async () => {
  const { status, body } = await get("/api/pa/dynamic-action-count");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 3);
  assert.equal(data.totalActions, 8);
  const byInfty = Object.fromEntries(data.items.map((i) => [i.infotype, i]));
  assert.equal(byInfty["0001"].dynamicActionSeqCount, 5);
  assert.equal(byInfty["0001"].dynamicCount, 3);
  assert.equal(byInfty["0002"].dynamicActionSeqCount, 2);
  assert.equal(byInfty["0002"].dynamicCount, 1);
  assert.equal(byInfty["0007"].dynamicActionSeqCount, 1);
  assert.equal(byInfty["0007"].dynamicCount, 1);
});

test("pa: dynamic-action-triggers parses unique source infotypes and list of unique target infotypes", async () => {
  const { status, body } = await get("/api/pa/dynamic-action-triggers");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 2);
  const i1 = data.items.find((i) => i.infotype === "0001");
  assert.deepEqual(i1.targetInfotypes, ["0002"]);

  const i2 = data.items.find((i) => i.infotype === "0002");
  assert.deepEqual(i2.targetInfotypes, ["0007"]);
});

test("pa: dynamic-action-by-operation groups by OPERA codes with dynamicActionCount and dynamicActionSeqCount", async () => {
  const { status, body } = await get("/api/pa/dynamic-action-by-operation");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 5);
  const byOpera = Object.fromEntries(data.items.map((i) => [i.operation, i]));
  assert.equal(byOpera["00"].dynamicActionCount, 1);
  assert.equal(byOpera["00"].dynamicActionSeqCount, 2);
  assert.equal(byOpera["02"].dynamicActionCount, 1);
  assert.equal(byOpera["02"].dynamicActionSeqCount, 1);
  assert.equal(byOpera["04"].dynamicActionCount, 1);
  assert.equal(byOpera["04"].dynamicActionSeqCount, 3);
  assert.equal(byOpera["06"].dynamicActionCount, 1);
  assert.equal(byOpera["06"].dynamicActionSeqCount, 1);
  assert.equal(byOpera["08"].dynamicActionCount, 1);
  assert.equal(byOpera["08"].dynamicActionSeqCount, 1);
});

test("pa: dynamic-action-routines extracts routine names inside parentheses", async () => {
  const { status, body } = await get("/api/pa/dynamic-action-routines");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 3);
  const r1 = data.items.find((i) => i.infotype === "0001");
  assert.equal(r1.uniqueRoutineCount, 2);
  assert.equal(r1.routineNames, "DATE_CHECK, MASSN_CHECK");
  assert.equal(r1.totalDynamicActions, 3);
});

