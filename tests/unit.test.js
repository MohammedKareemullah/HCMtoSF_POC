import test from "node:test";
import assert from "node:assert/strict";
import { sapDate } from "../src/shared/utils/sapValues.js";
import { normalizeTableRows } from "../src/integrations/mcp/sapTableReader.js";
import { buildStatusSummary, countryName, buildPayrollMonths } from "../src/modules/headcount/headcount.processor.js";
import { SyncCoordinator } from "../src/shared/sync/syncCoordinator.js";

test("sapDate converts SAP dates and rejects junk", () => {
  assert.equal(sapDate("20240229"), "2024-02-29");
  assert.equal(sapDate("99991231"), "9999-12-31");
  assert.equal(sapDate("00000000"), null);
  assert.equal(sapDate("20230230"), null);
  assert.equal(sapDate(""), null);
  assert.equal(sapDate(undefined), null);
});

test("normalizeTableRows understands the common response shapes", () => {
  const fields = ["PERNR", "STAT2"];
  const expected = [{ PERNR: "1", STAT2: "3" }, { PERNR: "2", STAT2: "0" }];

  assert.deepEqual(normalizeTableRows({ rows: ["1         |3", "2|0"] }, fields), expected);
  assert.deepEqual(normalizeTableRows(["1|3", "2|0"], fields), expected);
  assert.deepEqual(normalizeTableRows("PERNR|STAT2\n1|3\n2|0", fields), expected);
  assert.deepEqual(normalizeTableRows({ data: [{ WA: "1|3" }, { WA: "2|0" }] }, fields), expected);
  assert.deepEqual(normalizeTableRows({ rows: [{ pernr: "1", stat2: "3" }, { PERNR: "2", STAT2: "0" }] }, fields), expected);
  assert.deepEqual(normalizeTableRows({ result: { data: [["1", "3"], ["2", "0"]] } }, fields), expected);
  assert.deepEqual(normalizeTableRows({ rows: [] }, fields), []);
});

test("normalizeTableRows fails loudly instead of returning empty data", () => {
  const fields = ["PERNR", "STAT2"];
  assert.throws(() => normalizeTableRows({ status: "ok", message: "hi" }, fields), /Unrecognised/);
  assert.throws(() => normalizeTableRows({ rows: ["1|3|extra"] }, fields), /3 column/);
  assert.throws(() => normalizeTableRows(null, fields), /Unrecognised/);
});

test("status summary always lists the four statuses and surfaces unexpected codes", () => {
  const s = buildStatusSummary([{ code: "3", employees: 5 }, { code: "7", employees: 1 }]);
  assert.deepEqual(
    s.items.map((i) => [i.label, i.employees]),
    [["Active", 5], ["Inactive", 0], ["Retiree", 0], ["Withdrawn", 0], ["Unknown (7)", 1]]
  );
  assert.equal(s.total, 6);
});

test("countryName and payroll period formatting", () => {
  assert.equal(countryName("IN"), "India");
  assert.equal(countryName(null), "Unknown");
  assert.equal(countryName("??"), "??");
  assert.deepEqual(buildPayrollMonths([{ period: "202403", employees: 4 }]).items[0], {
    period: "202403", year: 2024, month: 3, label: "2024-03", employees: 4,
  });
});

test("SyncCoordinator: one fetch per process, shared in-flight, stale fallback with cooldown", async () => {
  let runs = 0;
  let fail = false;
  let clock = 1_000;
  const c = new SyncCoordinator({
    runSync: async () => {
      runs++;
      await new Promise((r) => setTimeout(r, 10));
      if (fail) throw new Error("sap down");
      return { ok: true };
    },
    getLastSuccess: async () => ({ finishedAt: "2026-01-01T00:00:00Z" }),
    cooldownMs: 60_000,
    now: () => clock,
  });

  // concurrent first readers share a single fetch
  await Promise.all([c.ensureFresh(), c.ensureFresh(), c.ensureFresh()]);
  assert.equal(runs, 1);
  await c.ensureFresh();
  assert.equal(runs, 1, "no refetch once synced");

  // forced refresh fetches again, and a failed forced refresh surfaces the error
  await c.ensureFresh({ force: true });
  assert.equal(runs, 2);
  fail = true;
  await assert.rejects(c.ensureFresh({ force: true }), /sap down/);

  // a fresh process (no sync yet) whose first fetch fails serves stale data, then respects the cooldown
  runs = 0;
  const c2 = new SyncCoordinator({
    runSync: async () => { runs++; throw new Error("sap down"); },
    getLastSuccess: async () => ({ finishedAt: "2026-01-01T00:00:00Z" }),
    cooldownMs: 60_000,
    now: () => clock,
  });
  const first = await c2.ensureFresh();
  assert.equal(first.stale, true);
  assert.match(first.warning, /sap down/);
  await c2.ensureFresh();
  assert.equal(runs, 1, "cooldown: SAP not retried immediately");
  clock += 61_000;
  await c2.ensureFresh();
  assert.equal(runs, 2, "retried after cooldown");

  // nothing to fall back to -> the error propagates
  const c3 = new SyncCoordinator({
    runSync: async () => { throw new Error("sap down"); },
    getLastSuccess: async () => null,
    now: () => clock,
  });
  await assert.rejects(c3.ensureFresh(), /sap down/);
});
