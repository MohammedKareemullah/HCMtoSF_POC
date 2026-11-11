// End-to-end: mock MCP server -> real Postgres -> HTTP API (PE module)
//
// Expected values worked out by hand from mock/mockData.js:
//
// T549A: U1, I1, G1, D1 (std=4); Z1, Y1 (custom=2) -> total 6
// T549R: 01, 02, 03 (std=3); 50, 51 (custom=2) -> total 5
// PA0001 (distinct PERNR per ABKRS):
//   D1 -> 2 (1006, 1011)
//   G1 -> 2 (1004, 1007)
//   I1 -> 4 (1002, 1005, 1008, 1010)
//   U1 -> 5 (1001, 1002, 1003, 1009, 9999)
// T549A + T549N (SPRAS = 'E'):
//   01 -> "Monthly", 2 payroll areas (U1, I1)
//   02 -> "Semi-Monthly", 2 payroll areas (G1, D1)
//   50 -> "Bi-Weekly (Custom)", 1 payroll area (Z1)
//   51 -> "Special Payroll", 1 payroll area (Y1)
// T549B + T549C:
//   T549B: TARIF, NUMKR, LGMST -> std=3
//   T549C: ZTARF, ZNUMK -> custom=2
//   total -> 5
// T549D (FUNID = 'P'):
//   NUMKR -> 1 function ["NUMGEN"]
//   TARIF -> 2 functions ["CALC", "CHECK"] (CALC 01 + CALC 02 deduped)
// T512W:
//   std: /001, M001, /101 -> 3
//   custom: 1000, 1010, Z001, Y001, 9000 -> 5
//   total: 8
// T512W + T500T (SPRAS = 'E'):
//   10 -> "USA", 4 wage types
//   40 -> "India", 3 wage types
//   99 -> "Other Countries", 1 wage type
// Active Wage Types (PA0008, PA0014, PA0015, PA0267 within 24m) + T512T:
//   /001 -> "Valuation Basis 1"
//   1000 -> "Basic Salary"
//   1010 -> "Housing Allowance"
//   9000 -> "NA"
//   Z001 -> "Project Bonus"
//   total -> 5
// EP10 - T52C0 distinct SCHEM: XMOD, ZMOD, XINN -> std=3
//        T52C1 distinct SCHEM: ZCU1, YCU1 -> custom=2; total=5
// EP11 - T52C0 (FUNCO='COPY') subschemas: XINN->1, XMOD->2, ZMOD->1
//        T52C1 (FUNCO='COPY') subschemas: YCU1->1, ZCU1->2
// EP12 - T52C5 distinct CCYCL: X010, X020, M001 -> std=3; Z010, Y020, 9001 -> custom=3; total=6
// EP13 - T52A0 FU: ADVAL+MULTI -> std=2, ZTEST+YCALC -> custom=2, total=4
//               OP: ADDWT -> std=1, ZOPER -> custom=1, total=2
// EP14 - T52A0 custom: YCALC(FU), ZTEST(FU), ZOPER(OP) -> total=3
// EP15 - T599B: I1, U1, X1; HRPY_RGDIR active (FPEND >= today-24m): U1(20241231), I1(20241231)
//        X1 not in active runs -> unused; X1 endda=20231231
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

test("pe: first read triggers live SAP fetch and returns payroll area summary", async () => {
  const { status, body } = await get("/api/pe/payroll-area-summary");
  assert.equal(status, 200);

  const { data, meta } = body;
  assert.equal(meta.stale, false);
  assert.ok(meta.lastSyncedAt);

  assert.equal(data.stdPayrollAreas, 4);
  assert.equal(data.customPayrollAreas, 2);
  assert.equal(data.total, 6);
});

test("pe: period parameter summary separates std vs custom (50-99)", async () => {
  const { status, body } = await get("/api/pe/period-parameter-summary");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.stdPeriodParameters, 3);
  assert.equal(data.customPeriodParameters, 2);
  assert.equal(data.total, 5);
});

test("pe: employees per payroll area deduplicates PERNR", async () => {
  const { status, body } = await get("/api/pe/employees-per-payroll-area");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 4);
  assert.deepEqual(data.items, [
    { payrollArea: "D1", noOfEmployees: 2, employeeCount: 2 },
    { payrollArea: "G1", noOfEmployees: 2, employeeCount: 2 },
    { payrollArea: "I1", noOfEmployees: 4, employeeCount: 4 },
    { payrollArea: "U1", noOfEmployees: 5, employeeCount: 5 },
  ]);
});

test("pe: payroll areas per period parameter aggregates and maps text", async () => {
  const { status, body } = await get("/api/pe/payroll-areas-per-period");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 4);
  assert.deepEqual(data.items, [
    { permo: "01", periodParameter: "01", atext: "Monthly", periodParameterText: "Monthly", noOfPayrollAreas: 2 },
    { permo: "02", periodParameter: "02", atext: "Semi-Monthly", periodParameterText: "Semi-Monthly", noOfPayrollAreas: 2 },
    { permo: "50", periodParameter: "50", atext: "Bi-Weekly (Custom)", periodParameterText: "Bi-Weekly (Custom)", noOfPayrollAreas: 1 },
    { permo: "51", periodParameter: "51", atext: "Special Payroll", periodParameterText: "Special Payroll", noOfPayrollAreas: 1 },
  ]);
});

test("pe: company features summary aggregates T549B and T549C", async () => {
  const { status, body } = await get("/api/pe/company-features-summary");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.stdCompanyFeatures, 3);
  assert.equal(data.customCompanyFeatures, 2);
  assert.equal(data.total, 5);
});

test("pe: feature functions groups FUNID='P' functions and cleans suffixes", async () => {
  const { status, body } = await get("/api/pe/feature-functions");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 2);
  assert.deepEqual(data.items, [
    { feature: "NUMKR", noOfFunctions: 1, functions: ["NUMGEN"] },
    { feature: "TARIF", noOfFunctions: 2, functions: ["CALC", "CHECK"] },
  ]);
});

test("pe: wage type summary categorizes std vs custom wage types", async () => {
  const { status, body } = await get("/api/pe/wage-type-summary");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.stdWageTypes, 3);
  assert.equal(data.customWageTypes, 5);
  assert.equal(data.total, 8);
});

test("pe: wage types per country aggregates by MOLGA and maps country name", async () => {
  const { status, body } = await get("/api/pe/wage-types-per-country");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 3);
  assert.deepEqual(data.items, [
    { countryCode: "10", countryName: "USA", noOfWageTypes: 4 },
    { countryCode: "40", countryName: "India", noOfWageTypes: 3 },
    { countryCode: "99", countryName: "Other Countries", noOfWageTypes: 1 },
  ]);
});

test("pe: active wage types extracts wage types within 24m and maps descriptions", async () => {
  const { status, body } = await get("/api/pe/active-wage-types");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 5);
  assert.deepEqual(data.items, [
    { wageType: "/001", wageTypeText: "Valuation Basis 1" },
    { wageType: "1000", wageTypeText: "Basic Salary" },
    { wageType: "1010", wageTypeText: "Housing Allowance" },
    { wageType: "9000", wageTypeText: "NA" },
    { wageType: "Z001", wageTypeText: "Project Bonus" },
  ]);
});

test("pe: payroll schema summary counts standard (T52C0) and custom (T52C1) schemas", async () => {
  const { status, body } = await get("/api/pe/payroll-schema-summary");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.stdPayrollSchemas, 3);
  assert.equal(data.customPayrollSchemas, 2);
  assert.equal(data.total, 5);
});

test("pe: payroll schema subschemas counts subschemas (FUNCO='COPY') for std and custom", async () => {
  const { status, body } = await get("/api/pe/payroll-schema-subschemas");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.std.total, 3);
  assert.deepEqual(data.std.items, [
    { schema: "XINN", noOfSubschemas: 1 },
    { schema: "XMOD", noOfSubschemas: 2 },
    { schema: "ZMOD", noOfSubschemas: 1 },
  ]);
  assert.equal(data.custom.total, 2);
  assert.deepEqual(data.custom.items, [
    { schema: "YCU1", noOfSubschemas: 1 },
    { schema: "ZCU1", noOfSubschemas: 2 },
  ]);
});

test("pe: PCR summary classifies standard vs custom (starts with Z, Y, 9)", async () => {
  const { status, body } = await get("/api/pe/pcr-summary");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.stdPcr, 3);
  assert.equal(data.customPcr, 3);
  assert.equal(data.total, 6);
});

test("pe: payroll functions and operations summary classifies by OTYPE and Y/Z custom prefix", async () => {
  const { status, body } = await get("/api/pe/payroll-functions-operations-summary");
  assert.equal(status, 200);

  const { data } = body;
  assert.deepEqual(data.functions, {
    stdFunctions: 2,
    customFunctions: 2,
    total: 4,
  });
  assert.deepEqual(data.operations, {
    stdOperations: 1,
    customOperations: 1,
    total: 2,
  });
});

test("pe: custom functions and operations lists functions/operations starting with Z or Y", async () => {
  const { status, body } = await get("/api/pe/custom-functions-operations");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 3);
  assert.deepEqual(data.items, [
    { type: "Function", name: "YCALC", description: "Custom Function Y" },
    { type: "Function", name: "ZTEST", description: "Custom Function Z" },
    { type: "Operation", name: "ZOPER", description: "Custom Operation Z" },
  ]);
});

test("pe: unused payroll areas identifies configured areas absent from recent payroll runs", async () => {
  const { status, body } = await get("/api/pe/unused-payroll-areas");
  assert.equal(status, 200);

  const { data } = body;
  assert.equal(data.total, 1);
  assert.deepEqual(data.items, [
    { payrollArea: "X1", endDate: "2023-12-31" },
  ]);
});

