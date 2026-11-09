// End-to-end: mock MCP server (JWT-verified, paged, SSE for one table) -> real Postgres -> HTTP API.
//
// Expected values below were worked out by hand from mock/mockData.js:
//   12 employees in PA0000 (PERNR 9999 exists only in PA0001 and must be ignored)
//   status:   Active 8, Inactive 2, Retiree 1, Withdrawn 1
//   country:  India 4, United States 3, Germany 2, United Kingdom 2, Unknown 1 (1012 has no PA0001 row)
//   company:  1000 -> 5, 2000 -> 4, 3000 -> 2, Unknown 1
//   payroll:  2024-01 -> 4, 2024-02 -> 5, 2024-03 -> 4, 2024-06 -> 3
//   hires:    2015 1, 2018 1, 2019 1, 2020 1, 2021 2, 2022 2, 2023 2, 2024 2 (total 12)
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
process.env.SAP_PAGE_SIZE = "7"; // forces paging: PA0000 has 16 rows
process.env.PAYROLL_SRTZA_FILTER = "";
process.env.HIRE_MASSN_CODES = "01";

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
const pa0000Skips = () => mock.calls.filter((c) => c.table === "PA0000").map((c) => c.rowSkips);

before(async () => {
  await runMigrations(); // creates hr_kpi_test if missing
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"); // deterministic start
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

test("first read triggers a live SAP fetch (paged, JWT-authenticated, SSE handled)", async () => {
  assert.equal(mock.calls.length, 0);
  const { status, body } = await get("/api/headcount/status-summary");
  assert.equal(status, 200);

  assert.deepEqual(
    body.data.items.map((i) => [i.code, i.label, i.employees]),
    [["3", "Active", 8], ["1", "Inactive", 2], ["2", "Retiree", 1], ["0", "Withdrawn", 1]]
  );
  assert.equal(body.data.total, 12);
  assert.equal(body.meta.stale, false);
  assert.ok(body.meta.lastSyncedAt);

  // 16 rows at page size 7 -> pages at skips 0, 7, 14 and a final empty page at 16
  assert.deepEqual(pa0000Skips(), [0, 7, 14, 16]);
});

test("later reads come from Postgres without touching SAP again", async () => {
  const before = mock.calls.length;
  await get("/api/headcount/by-country");
  await get("/api/headcount/payroll-by-month");
  assert.equal(mock.calls.length, before);
});

test("employees per country (PA0001 limited to PA0000 employees, latest record wins)", async () => {
  const { body } = await get("/api/headcount/by-country");
  assert.equal(body.data.total, 12);
  assert.deepEqual(
    Object.fromEntries(body.data.items.map((i) => [i.country, i.employees])),
    { India: 4, "United States": 3, Germany: 2, "United Kingdom": 2, Unknown: 1 }
  );
  assert.equal(body.data.items[0].country, "India"); // sorted by headcount desc
});

test("employees per company code", async () => {
  const { body } = await get("/api/headcount/by-company-code");
  assert.equal(body.data.total, 12);
  assert.deepEqual(
    Object.fromEntries(body.data.items.map((i) => [i.companyCode, [i.companyName, i.employees]])),
    {
      1000: ["Acme US Inc.", 5],
      2000: ["Acme India Pvt Ltd", 4],
      3000: ["Acme UK Ltd", 2],
      null: [null, 1],
    }
  );
});

test("employee table: status text, country name, company, groups; PERNR 9999 excluded", async () => {
  const { body } = await get("/api/headcount/employees?pageSize=100");
  assert.equal(body.data.total, 12);
  assert.ok(!body.data.items.some((e) => e.pernr === "00009999"));

  const byPernr = Object.fromEntries(body.data.items.map((e) => [e.pernr, e]));
  assert.deepEqual(byPernr["00001002"], {
    pernr: "00001002",
    statusCode: "3", status: "Active",
    countryCode: "IN", country: "India",
    companyCode: "2000", companyName: "Acme India Pvt Ltd",
    personnelArea: "2010",
    employeeGroup: "1", employeeSubgroup: "DB", payrollArea: "I1", // the 2022 record, not the 2019 one
  });
  assert.equal(byPernr["00001004"].status, "Retiree");
  assert.equal(byPernr["00001004"].country, "United Kingdom");
  assert.equal(byPernr["00001003"].status, "Withdrawn"); // latest PA0000 record, not the older 'Active' one
  assert.equal(byPernr["00001012"].country, "Unknown");
  assert.equal(byPernr["00001012"].companyCode, null);
});

test("employee table: filters and pagination", async () => {
  const filtered = await get("/api/headcount/employees?status=3&country=in");
  assert.deepEqual(filtered.body.data.items.map((e) => e.pernr), ["00001002", "00001008"]);
  assert.equal(filtered.body.data.total, 2);

  const unknown = await get("/api/headcount/employees?country=UNKNOWN");
  assert.deepEqual(unknown.body.data.items.map((e) => e.pernr), ["00001012"]);

  const page3 = await get("/api/headcount/employees?page=3&pageSize=5");
  assert.equal(page3.body.data.items.length, 2);
  assert.equal(page3.body.data.totalPages, 3);

  const bad = await get("/api/headcount/employees?status=9");
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, "VALIDATION_ERROR");
});

test("payroll: distinct employees per month actually present (no assumed months)", async () => {
  const { body } = await get("/api/headcount/payroll-by-month");
  assert.deepEqual(
    body.data.items.map((i) => [i.label, i.employees]),
    [["2024-01", 4], ["2024-02", 5], ["2024-03", 4], ["2024-06", 3]]
  );
});

test("hires per year (and by country)", async () => {
  const { body } = await get("/api/headcount/hires-per-year");
  assert.deepEqual(
    body.data.byYear.map((r) => [r.year, r.hires]),
    [[2015, 1], [2018, 1], [2019, 1], [2020, 1], [2021, 2], [2022, 2], [2023, 2], [2024, 2]]
  );
  assert.equal(body.data.total, 12);

  const y2021 = body.data.byCountry.filter((r) => r.year === 2021).map((r) => [r.country, r.hires]);
  assert.deepEqual(y2021, [["Germany", 1], ["India", 1]]);
  const y2024 = body.data.byCountry.filter((r) => r.year === 2024).map((r) => [r.country, r.hires]);
  assert.deepEqual(y2024, [["Germany", 1], ["Unknown", 1]]);
});

test("overview returns every section in one call", async () => {
  const { body } = await get("/api/headcount/overview");
  assert.deepEqual(Object.keys(body.data).sort(), ["byCompanyCode", "byCountry", "hires", "payroll", "status"]);
});

test("POST /sync re-fetches from SAP and reports row counts", async () => {
  const before = mock.calls.length;
  const { status, body } = await post("/api/headcount/sync");
  assert.equal(status, 200);
  assert.equal(body.data.status, "success");
  assert.deepEqual(body.data.rowCounts, { pa0000: 16, pa0001: 13, t500p: 6, t001: 4, hrpy_rgdir: 17 });
  assert.ok(mock.calls.length > before);
});

test("when SAP is down: sync fails with 502, previous data keeps being served", async () => {
  mock.setFailing(true);
  const failed = await post("/api/headcount/sync");
  assert.equal(failed.status, 502);
  assert.equal(failed.body.error.code, "MCP_ERROR");
  mock.setFailing(false);

  const { body } = await get("/api/headcount/status-summary"); // data from the last good sync is intact
  assert.equal(body.data.total, 12);

  const status = await get("/api/headcount/sync/status");
  assert.equal(status.body.data.latestRun.status, "failed");
  assert.equal(status.body.data.lastSuccess.status, "success");
});

test("health and unknown routes", async () => {
  assert.equal((await get("/health")).body.status, "ok");
  assert.equal((await get("/api/nope")).status, 404);
});
