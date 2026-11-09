// Small, hand-checkable SAP dataset used by the mock MCP server (dev + tests).
// Expected results are documented next to the e2e test (tests/headcount.e2e.test.js).

const p = (n) => String(n).padStart(8, "0"); // PERNR is an 8-digit, zero-padded key in SAP

// PA0000: PERNR, BEGDA, ENDDA, MASSN, STAT2   (deliberately NOT in chronological order)
const pa0000 = [
  [1003, "20230701", "99991231", "10", "0"],
  [1001, "20180115", "99991231", "01", "3"],
  [1002, "20220101", "99991231", "02", "3"],
  [1002, "20190301", "20211231", "01", "3"],
  [1003, "20200601", "20230630", "01", "3"],
  [1004, "20241001", "99991231", "11", "2"],
  [1004, "20150401", "20240930", "01", "3"],
  [1005, "20210201", "99991231", "01", "1"],
  [1006, "20210901", "99991231", "01", "3"],
  [1007, "20220315", "99991231", "01", "3"],
  [1008, "20220801", "99991231", "01", "3"],
  [1009, "20230110", "99991231", "01", "3"],
  [1010, "20240501", "99991231", "12", "1"],
  [1010, "20230501", "20240430", "01", "3"],
  [1011, "20240201", "99991231", "01", "3"],
  [1012, "20240901", "99991231", "01", "3"],
].map(([n, BEGDA, ENDDA, MASSN, STAT2]) => ({ PERNR: p(n), BEGDA, ENDDA, MASSN, STAT2 }));

// PA0001: PERNR, BEGDA, ENDDA, BUKRS, WERKS, PERSG, PERSK, ABKRS
// 1002 moved company/plant in 2022 (two records); 1012 has no PA0001 row; 9999 exists ONLY here.
const pa0001 = [
  [1001, "20180115", "99991231", "1000", "1010", "1", "DA", "U1"],
  [1002, "20220101", "99991231", "2000", "2010", "1", "DB", "I1"],
  [1002, "20190301", "20211231", "1000", "1010", "1", "DA", "U1"],
  [1003, "20200601", "99991231", "1000", "1010", "1", "DA", "U1"],
  [1004, "20150401", "99991231", "3000", "3010", "5", "DA", "G1"],
  [1005, "20210201", "99991231", "2000", "2010", "1", "DB", "I1"],
  [1006, "20210901", "99991231", "1000", "1020", "1", "DC", "D1"],
  [1007, "20220315", "99991231", "3000", "3010", "1", "DA", "G1"],
  [1008, "20220801", "99991231", "2000", "2020", "1", "DB", "I1"],
  [1009, "20230110", "99991231", "1000", "1010", "1", "DA", "U1"],
  [1010, "20230501", "99991231", "2000", "2010", "1", "DB", "I1"],
  [1011, "20240201", "99991231", "1000", "1020", "1", "DC", "D1"],
  [9999, "20200101", "99991231", "1000", "1010", "1", "DA", "U1"],
].map(([n, BEGDA, ENDDA, BUKRS, WERKS, PERSG, PERSK, ABKRS]) => ({
  PERNR: p(n), BEGDA, ENDDA, BUKRS, WERKS, PERSG, PERSK, ABKRS,
}));

const t500p = [
  { WERKS: "1010", LAND1: "US" },
  { WERKS: "1020", LAND1: "DE" },
  { WERKS: "2010", LAND1: "IN" },
  { WERKS: "2020", LAND1: "IN" },
  { WERKS: "3010", LAND1: "GB" },
  { WERKS: "4010", LAND1: "FR" }, // unused plant
];

const t001 = [
  { BUKRS: "1000", BUTXT: "Acme US Inc." },
  { BUKRS: "2000", BUTXT: "Acme India Pvt Ltd" },
  { BUKRS: "3000", BUTXT: "Acme UK Ltd" },
  { BUKRS: "4000", BUTXT: "Unused Co" },
];

// HRPY_RGDIR: PERNR, ABKRS, FPPER, SRTZA  -- months present: 2024-01, -02, -03 and -06 (a gap on purpose)
const hrpy = [
  [1001, "U1", "202401", "A"], [1002, "I1", "202401", "A"], [1003, "U1", "202401", "A"], [1004, "G1", "202401", "A"],
  [1001, "U1", "202401", "P"], // old (superseded) result for an employee already counted
  [1001, "U1", "202402", "A"], [1002, "I1", "202402", "A"], [1003, "U1", "202402", "A"], [1004, "G1", "202402", "A"],
  [1005, "I1", "202402", "A"],
  [1001, "U1", "202403", "A"], [1002, "I1", "202403", "A"], [1005, "I1", "202403", "A"], [1006, "D1", "202403", "A"],
  [1001, "U1", "202406", "A"], [1006, "D1", "202406", "A"], [1007, "G1", "202406", "A"],
].map(([n, ABKRS, FPPER, SRTZA]) => ({ PERNR: p(n), ABKRS, FPPER, SRTZA }));

export const MOCK_TABLES = { PA0000: pa0000, PA0001: pa0001, T500P: t500p, T001: t001, HRPY_RGDIR: hrpy };
