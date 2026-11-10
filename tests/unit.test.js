import test from "node:test";
import assert from "node:assert/strict";
import { sapDate } from "../src/shared/utils/sapValues.js";
import { normalizeTableRows } from "../src/integrations/mcp/sapTableReader.js";
import { buildStatusSummary, countryName, buildPayrollMonths } from "../src/modules/headcount/headcount.processor.js";
import { SyncCoordinator } from "../src/shared/sync/syncCoordinator.js";
import {
  buildInfotypeCategorySummary,
  buildSubtypeCountsPerInfotype,
  buildInfotypeSubtypeTable,
} from "../src/modules/hcm_core/hcm_core.processor.js";
import { categoriseInfotype } from "../src/modules/hcm_core/hcm_core.constants.js";
import {
  classifyScreen,
  EDYNR_CATEGORIES,
  LDYNR_CATEGORIES,
  OPERA_LABELS,
} from "../src/modules/pa/pa.constants.js";
import {
  buildSingleScreenClassification,
  buildListScreenClassification,
  buildModulePoolMapping,
  buildFieldVisibilitySummary,
  buildDynamicActionCount,
  buildDynamicActionTriggers,
  buildDynamicActionByOperation,
  buildDynamicActionRoutines,
} from "../src/modules/pa/pa.processor.js";
import {
  buildObjectTypesSummary,
  buildRelationshipsSummary,
  buildEvaluationPathsSummary,
  buildObjectsPerPlanVersion,
  buildRelationshipsPerPlanVersion,
  buildAuthProfilesSummary,
} from "../src/modules/om/om.processor.js";

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

test("categoriseInfotype maps infotype numbers to the correct SAP functional area", () => {
  assert.equal(categoriseInfotype("0000"), "Personnel Administration (PA)");
  assert.equal(categoriseInfotype("0999"), "Personnel Administration (PA)");
  assert.equal(categoriseInfotype("1000"), "Organizational Management (OM)");
  assert.equal(categoriseInfotype("2001"), "Time Management (TM)");
  assert.equal(categoriseInfotype("3500"), "SAP Reserved");
  assert.equal(categoriseInfotype("4001"), "Recruitment");
  assert.equal(categoriseInfotype("5100"), "E-Recruiting & Learning");
  assert.equal(categoriseInfotype("9000"), "Custom Infotypes");
  // outside all ranges -> Unknown
  assert.equal(categoriseInfotype("6000"), "Unknown");
  assert.equal(categoriseInfotype("ZZZZ"), "Unknown");
});

test("buildInfotypeCategorySummary groups distinct infotypes by category with zero counts for empty ranges", () => {
  const rows = [
    { infty: "0000" }, { infty: "0001" }, { infty: "0002" },  // PA: 3
    { infty: "1000" },                                          // OM: 1
    { infty: "9000" },                                          // Custom: 1
  ];
  const result = buildInfotypeCategorySummary(rows);
  assert.equal(result.total, 5);

  const byCategory = Object.fromEntries(result.items.map((i) => [i.category, i.infotypeCount]));
  assert.equal(byCategory["Personnel Administration (PA)"], 3);
  assert.equal(byCategory["Organizational Management (OM)"], 1);
  assert.equal(byCategory["Custom Infotypes"], 1);
  // TM, SAP Reserved, Recruitment, E-Recruiting must still appear with 0
  assert.equal(byCategory["Time Management (TM)"], 0);
  assert.equal(byCategory["SAP Reserved"], 0);
  assert.equal(byCategory["Recruitment"], 0);
  assert.equal(byCategory["E-Recruiting & Learning"], 0);
});

test("buildSubtypeCountsPerInfotype attaches category and correct counts", () => {
  const rows = [
    { infty: "0001", subtype_count: 2 },
    { infty: "1000", subtype_count: 3 },
    { infty: "9000", subtype_count: 1 },
  ];
  const result = buildSubtypeCountsPerInfotype(rows);
  assert.equal(result.total, 3);
  assert.equal(result.totalSubtypes, 6);

  const byInfotype = Object.fromEntries(result.items.map((i) => [i.infotype, i]));
  assert.equal(byInfotype["0001"].category, "Personnel Administration (PA)");
  assert.equal(byInfotype["1000"].category, "Organizational Management (OM)");
  assert.equal(byInfotype["9000"].category, "Custom Infotypes");
  assert.equal(byInfotype["9000"].subtypeCount, 1);
});

test("buildInfotypeSubtypeTable attaches category and infotype text; NA for missing text and 0 for missing subtypes", () => {
  const rows = [
    { infty: "0001", subtype_count: 2, itext: "Organizational Assignment" },
    { infty: "0008", subtype_count: 0, itext: "NA" },
    { infty: "9000", subtype_count: 1, itext: "Custom Infotype 9000" },
  ];
  const result = buildInfotypeSubtypeTable(rows);
  assert.equal(result.total, 3);

  const r0001 = result.items.find((r) => r.infotype === "0001");
  assert.equal(r0001.category, "Personnel Administration (PA)");
  assert.equal(r0001.noOfSubtypes, 2);
  assert.equal(r0001.infotypeText, "Organizational Assignment");

  const r0008 = result.items.find((r) => r.infotype === "0008");
  assert.equal(r0008.noOfSubtypes, 0);
  assert.equal(r0008.infotypeText, "NA");

  const r9000 = result.items.find((r) => r.infotype === "9000");
  assert.equal(r9000.category, "Custom Infotypes");
});

test("classifyScreen correctly identifies EDYNR and LDYNR screen types", () => {
  // EDYNR
  assert.equal(classifyScreen("2000", EDYNR_CATEGORIES), "Universal Standard");
  assert.equal(classifyScreen("2001", EDYNR_CATEGORIES), "Country Specific");
  assert.equal(classifyScreen("2500", EDYNR_CATEGORIES), "Country Specific");
  assert.equal(classifyScreen("2899", EDYNR_CATEGORIES), "Country Specific");
  assert.equal(classifyScreen("2900", EDYNR_CATEGORIES), "Fast Entry Screens");
  assert.equal(classifyScreen("2999", EDYNR_CATEGORIES), "Fast Entry Screens");
  assert.equal(classifyScreen("0100", EDYNR_CATEGORIES), "Custom");
  assert.equal(classifyScreen("9500", EDYNR_CATEGORIES), "Custom");
  assert.equal(classifyScreen("1500", EDYNR_CATEGORIES), "Others");
  assert.equal(classifyScreen(null, EDYNR_CATEGORIES), "Others");

  // LDYNR
  assert.equal(classifyScreen("3000", LDYNR_CATEGORIES), "Universal Standard");
  assert.equal(classifyScreen("3001", LDYNR_CATEGORIES), "Country Specific");
  assert.equal(classifyScreen("3500", LDYNR_CATEGORIES), "Country Specific");
  assert.equal(classifyScreen("3999", LDYNR_CATEGORIES), "Country Specific");
  assert.equal(classifyScreen("0200", LDYNR_CATEGORIES), "Custom");
  assert.equal(classifyScreen("9200", LDYNR_CATEGORIES), "Custom");
  assert.equal(classifyScreen("2000", LDYNR_CATEGORIES), "Others");
});

test("buildSingleScreenClassification and buildListScreenClassification structure results correctly", () => {
  const rows = [
    { infty: "0001", edynr: "2000", ldynr: "3000" },
    { infty: "0002", edynr: "2010", ldynr: "3100" },
    { infty: "9000", edynr: "9100", ldynr: "9100" },
  ];

  const single = buildSingleScreenClassification(rows);
  assert.equal(single.total, 3);
  assert.equal(single.items.length, 3);
  assert.equal(single.items[0].classification, "Universal Standard");
  assert.equal(single.items[1].classification, "Country Specific");
  assert.equal(single.items[2].classification, "Custom");

  const list = buildListScreenClassification(rows);
  assert.equal(list.total, 3);
  assert.equal(list.items.length, 3);
  assert.equal(list.items[0].classification, "Universal Standard");
  assert.equal(list.items[1].classification, "Country Specific");
  assert.equal(list.items[2].classification, "Custom");
});

test("buildModulePoolMapping formats infotype and modulePool output", () => {
  const rows = [
    { infty: "0001", module_pool: "MP000100" },
    { infty: "0002", module_pool: "MP000200" },
  ];
  const result = buildModulePoolMapping(rows);
  assert.equal(result.total, 2);
  assert.deepEqual(result.items, [
    { infotype: "0001", modulePool: "MP000100" },
    { infotype: "0002", modulePool: "MP000200" },
  ]);
});

test("buildFieldVisibilitySummary summarizes indicator symbol counts", () => {
  const rows = [
    { infty: "0001", hidden: 2, display_only: 2, required: 2, optional: 6 },
    { infty: "0002", hidden: 1, display_only: 0, required: 1, optional: 0 },
  ];
  const result = buildFieldVisibilitySummary(rows);
  assert.equal(result.total, 2);
  assert.equal(result.items[0].hidden, 2);
  assert.equal(result.items[0].displayOnly, 2);
  assert.equal(result.items[0].required, 2);
  assert.equal(result.items[0].optional, 6);
});

test("buildDynamicActionCount calculates total actions and items with dynamicActionSeqCount and dynamicCount", () => {
  const rows = [
    { infty: "0001", dynamic_action_seq_count: 5, dynamic_count: 3 },
    { infty: "0002", dynamic_action_seq_count: 2, dynamic_count: 1 },
  ];
  const result = buildDynamicActionCount(rows);
  assert.equal(result.total, 2);
  assert.equal(result.totalActions, 7);
  assert.deepEqual(result.items, [
    { infotype: "0001", dynamicActionSeqCount: 5, dynamicCount: 3 },
    { infotype: "0002", dynamicActionSeqCount: 2, dynamicCount: 1 },
  ]);
});

test("buildDynamicActionTriggers outputs unique infotypes and list of unique target infotypes", () => {
  const rows = [
    { source_infotype: "0001", target_infotype: "0002" },
    { source_infotype: "0001", target_infotype: "0002" }, // duplicate target
    { source_infotype: "0001", target_infotype: "0007" },
    { source_infotype: "0002", target_infotypes: ["0007"] },
  ];
  const result = buildDynamicActionTriggers(rows);
  assert.equal(result.total, 2);
  assert.deepEqual(result.items, [
    { infotype: "0001", targetInfotypes: ["0002", "0007"] },
    { infotype: "0002", targetInfotypes: ["0007"] },
  ]);
});

test("buildDynamicActionByOperation maps OPERA descriptions, block counts, and seq counts", () => {
  const rows = [
    { opera: "04", dynamic_action_count: 1, dynamic_action_seq_count: 3 },
    { opera: "02", dynamic_action_count: 1, dynamic_action_seq_count: 1 },
  ];
  const result = buildDynamicActionByOperation(rows);
  assert.equal(result.total, 2);
  assert.equal(result.items[0].description, "Create");
  assert.equal(result.items[0].dynamicActionCount, 1);
  assert.equal(result.items[0].dynamicActionSeqCount, 3);
  assert.equal(result.items[1].description, "Change");
  assert.equal(result.items[1].dynamicActionCount, 1);
  assert.equal(result.items[1].dynamicActionSeqCount, 1);
});

test("buildDynamicActionRoutines formats routine names and counts", () => {
  const rows = [
    {
      infty: "0001",
      unique_routine_count: 2,
      routine_names: "DATE_CHECK, MASSN_CHECK",
      total_executions: 3,
    },
  ];
  const result = buildDynamicActionRoutines(rows);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].infotype, "0001");
  assert.equal(result.items[0].uniqueRoutineCount, 2);
  assert.equal(result.items[0].routineNames, "DATE_CHECK, MASSN_CHECK");
  assert.equal(result.items[0].totalDynamicActions, 3);
});

test("buildObjectTypesSummary separates standard vs custom (starts with 9) OM objects", () => {
  const rows = [
    { otype: "O" },
    { otype: "S" },
    { otype: "C" },
    { otype: "9A" },
    { otype: "9Z" },
  ];
  const result = buildObjectTypesSummary(rows);
  assert.equal(result.stdOmObjects, 3);
  assert.equal(result.customOmObjects, 2);
  assert.equal(result.total, 5);

  const preAgg = buildObjectTypesSummary({ std_om_objects: 5, custom_om_objects: 1, total: 6 });
  assert.equal(preAgg.stdOmObjects, 5);
  assert.equal(preAgg.customOmObjects, 1);
});

test("buildRelationshipsSummary separates standard vs custom (starts with Z or 900-999)", () => {
  const rows = [
    { relat: "002" },
    { relat: "003" },
    { relat: "A01" },
    { relat: "Z01" },
    { relat: "950" },
  ];
  const result = buildRelationshipsSummary(rows);
  assert.equal(result.stdOmRelationships, 3);
  assert.equal(result.customOmRelationships, 2);
  assert.equal(result.total, 5);
});

test("buildEvaluationPathsSummary separates standard vs custom (starts with Z)", () => {
  const rows = [
    { wegid: "O-S-P" },
    { wegid: "SBES" },
    { wegid: "ZOM_PATH" },
  ];
  const result = buildEvaluationPathsSummary(rows);
  assert.equal(result.stdOmEvaluationPaths, 2);
  assert.equal(result.customOmEvaluationPaths, 1);
  assert.equal(result.total, 3);
});

test("buildObjectsPerPlanVersion formats PLVAR, PTEXT, and noOfObjects", () => {
  const rows = [
    { plvar: "01", ptext: "Current plan", no_of_objects: 3 },
    { plvar: "02", ptext: "Version 02", no_of_objects: 1 },
  ];
  const result = buildObjectsPerPlanVersion(rows);
  assert.equal(result.total, 2);
  assert.deepEqual(result.items, [
    { plvar: "01", ptext: "Current plan", noOfObjects: 3 },
    { plvar: "02", ptext: "Version 02", noOfObjects: 1 },
  ]);
});

test("buildRelationshipsPerPlanVersion formats PLVAR, PTEXT, and noOfRelationships", () => {
  const rows = [
    { plvar: "01", ptext: "Current plan", no_of_relationships: 2 },
    { plvar: "02", ptext: "Version 02", no_of_relationships: 2 },
  ];
  const result = buildRelationshipsPerPlanVersion(rows);
  assert.equal(result.total, 2);
  assert.deepEqual(result.items, [
    { plvar: "01", ptext: "Current plan", noOfRelationships: 2 },
    { plvar: "02", ptext: "Version 02", noOfRelationships: 2 },
  ]);
});

test("buildAuthProfilesSummary calculates assigned vs unassigned structural profiles", () => {
  const input = {
    t77pq: [{ profl: "ALL" }, { profl: "HR_MGR" }, { profl: "FIN_VIEW" }],
    t77ua: [{ profl: "ALL" }, { profl: "HR_MGR" }],
  };
  const result = buildAuthProfilesSummary(input);
  assert.equal(result.assignedAuthProfiles, 2);
  assert.equal(result.unassignedAuthProfiles, 1);
  assert.equal(result.total, 3);
});
