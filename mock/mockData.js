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

// ---------------------------------------------------------------------------
// HCM Core: T777D, T591A, T582S synthetic data
//
// Infotypes in mock (all distinct INFTY from T777D):
//   PA range  (0000-0999): 0000, 0001, 0002, 0007, 0008  -> 5 infotypes
//   OM range  (1000-1999): 1000, 1001                    -> 2 infotypes
//   TM range  (2000-2999): 2001                          -> 1 infotype
//   Custom    (9000-9999): 9000                          -> 1 infotype
//   Total distinct infotypes: 9
//
// 0001 has duplicate row in T777D to verify dedup works (should still count as 1).
// ---------------------------------------------------------------------------

// T777D: INFTY + REPID (intentional duplicate for dedup test)
const t777d = [
  { INFTY: "0000", REPID: "" },
  { INFTY: "0001", REPID: "MP000100" },
  { INFTY: "0001", REPID: "MP000100" }, // duplicate 0001
  { INFTY: "0002", REPID: "MP000200" },
  { INFTY: "0007", REPID: "MP000700" },
  { INFTY: "0008", REPID: "MP000800" },
  { INFTY: "1000", REPID: "MP100000" },
  { INFTY: "1001", REPID: "MP100100" },
  { INFTY: "2001", REPID: "MP200100" },
  { INFTY: "9000", REPID: "MP900000" },
];

// T591A: INFTY + SUBTY (subtypes per infotype)
// Subtype counts (distinct per INFTY):
//   0000 -> 1 (Z1)
//   0001 -> 2 (01, 02)   -- has duplicate (01) to verify dedup
//   0002 -> 0  (no rows in T591A)
//   0007 -> 3 (01, 02, 03)
//   0008 -> 1 (01)
//   1000 -> 2 (A, B)
//   9000 -> 1 (C1)
const t591a = [
  { INFTY: "0000", SUBTY: "Z1" },
  { INFTY: "0001", SUBTY: "01" }, { INFTY: "0001", SUBTY: "01" }, // duplicate subtype
  { INFTY: "0001", SUBTY: "02" },
  { INFTY: "0007", SUBTY: "01" }, { INFTY: "0007", SUBTY: "02" }, { INFTY: "0007", SUBTY: "03" },
  { INFTY: "0008", SUBTY: "01" },
  { INFTY: "1000", SUBTY: "A" }, { INFTY: "1000", SUBTY: "B" },
  { INFTY: "9000", SUBTY: "C1" },
];

// T582S: SPRSL, INFTY, ITEXT (English 'E' + German 'D' rows; only E should surface)
const t582s = [
  { SPRSL: "E", INFTY: "0000", ITEXT: "Actions" },
  { SPRSL: "D", INFTY: "0000", ITEXT: "Massnahmen" },
  { SPRSL: "E", INFTY: "0001", ITEXT: "Organizational Assignment" },
  { SPRSL: "E", INFTY: "0002", ITEXT: "Personal Data" },
  { SPRSL: "E", INFTY: "0007", ITEXT: "Planned Working Time" },
  // 0008 intentionally has no E text to verify null handling
  { SPRSL: "D", INFTY: "0008", ITEXT: "Basisbezuege" },
  { SPRSL: "E", INFTY: "1000", ITEXT: "Object" },
  { SPRSL: "E", INFTY: "1001", ITEXT: "Relationships" },
  { SPRSL: "E", INFTY: "2001", ITEXT: "Absences" },
  { SPRSL: "E", INFTY: "9000", ITEXT: "Custom Infotype 9000" },
];

// ---------------------------------------------------------------------------
// PA Module: T582A, T588M, T588Z synthetic data
// ---------------------------------------------------------------------------

// T582A: INFTY, EDYNR, LDYNR
const pa_t582a = [
  { INFTY: "0001", EDYNR: "2000", LDYNR: "3000" }, // universal / universal
  { INFTY: "0002", EDYNR: "2010", LDYNR: "3100" }, // country / country
  { INFTY: "0007", EDYNR: "2500", LDYNR: "3200" }, // country / country
  { INFTY: "0014", EDYNR: "2900", LDYNR: "3050" }, // fast entry / country
  { INFTY: "9000", EDYNR: "9100", LDYNR: "9100" }, // custom / custom
  { INFTY: "0100", EDYNR: "0100", LDYNR: "0200" }, // custom / custom
  { INFTY: "0021", EDYNR: "1500", LDYNR: "4000" }, // others / others
];

// T588M: REPNA, DYNNR, ADYNR, DBILD
const pa_t588m = [
  { REPNA: "MP000100", DYNNR: "1000", ADYNR: "2000", DBILD: "+-*.-+*.." }, // diff -> EP2, EP3
  { REPNA: "MP000100", DYNNR: "1000", ADYNR: "1000", DBILD: "..." },        // same -> no EP2, EP3
  { REPNA: "MP000200", DYNNR: "2000", ADYNR: "3000", DBILD: "--+*" },       // diff -> EP2, EP3
  { REPNA: "MP000700", DYNNR: "", ADYNR: "1000", DBILD: "..." },        // blank -> no EP2, EP3
  { REPNA: "MP000700", DYNNR: "2000", ADYNR: "3000", DBILD: "++-." },       // diff -> EP2, EP3
  { REPNA: "MP999999", DYNNR: "1000", ADYNR: "2000", DBILD: "++-" },        // unmapped in T777D -> excluded
];

// T588Z: INFTY, SUBTY, FNAME, OPERA, SEQNO, KENNZ, VINFO
const pa_t588z = [
  { INFTY: "0001", SUBTY: "", FNAME: "MASSN", OPERA: "04", SEQNO: "010", KENNZ: "F", VINFO: "RPMASS00(MASSN_CHECK)" },
  { INFTY: "0001", SUBTY: "", FNAME: "MASSN", OPERA: "04", SEQNO: "020", KENNZ: "I", VINFO: "INS(0002,,,,,,)" },
  { INFTY: "0001", SUBTY: "", FNAME: "MASSN", OPERA: "04", SEQNO: "030", KENNZ: "W", VINFO: "MASSN = '01'" },
  { INFTY: "0001", SUBTY: "", FNAME: "ENDDA", OPERA: "02", SEQNO: "010", KENNZ: "F", VINFO: "RPDIEN00(DATE_CHECK)" },
  { INFTY: "0001", SUBTY: "", FNAME: "TRFGR", OPERA: "08", SEQNO: "010", KENNZ: "F", VINFO: "RPMASS00(MASSN_CHECK)" },
  { INFTY: "0002", SUBTY: "", FNAME: "GBDAT", OPERA: "00", SEQNO: "010", KENNZ: "F", VINFO: "RPDKON00(BIRTH_CHECK)" },
  { INFTY: "0002", SUBTY: "", FNAME: "GBDAT", OPERA: "00", SEQNO: "020", KENNZ: "I", VINFO: "COP(0007,,,,)" },
  { INFTY: "0007", SUBTY: "", FNAME: "SCHKZ", OPERA: "06", SEQNO: "010", KENNZ: "F", VINFO: "RPTIME00(SHIFT_CHECK)" },
];

// ---------------------------------------------------------------------------
// OM Module: T778O, T778V, T778A, HRP1000, HRP1001, T778P, T77PQ, T77UA
// ---------------------------------------------------------------------------

const om_t778o = [
  { OTYPE: "O" },
  { OTYPE: "S" },
  { OTYPE: "C" },
  { OTYPE: "9A" },
  { OTYPE: "9Z" },
];

const om_t778v = [
  { RELAT: "002" },
  { RELAT: "003" },
  { RELAT: "A01" },
  { RELAT: "Z01" },
  { RELAT: "950" },
];

const om_t778a = [
  { WEGID: "O-S-P" },
  { WEGID: "SBES" },
  { WEGID: "ZOM_PATH" },
];

const om_hrp1000 = [
  { OTYPE: "O", PLVAR: "01" },
  { OTYPE: "S", PLVAR: "01" },
  { OTYPE: "C", PLVAR: "01" },
  { OTYPE: "O", PLVAR: "02" },
];

const om_hrp1001 = [
  { RELAT: "002", PLVAR: "01" },
  { RELAT: "003", PLVAR: "01" },
  { RELAT: "002", PLVAR: "02" },
  { RELAT: "Z01", PLVAR: "02" },
];

const om_t778p = [
  { PLVAR: "01", PTEXT: "Current plan" },
  { PLVAR: "02", PTEXT: "Version 02" },
];

const om_t77pq = [
  { PROFL: "ALL" },
  { PROFL: "HR_MGR" },
  { PROFL: "FIN_VIEW" },
];

const om_t77ua = [
  { UNAME: "USER1", PROFL: "ALL" },
  { UNAME: "USER2", PROFL: "ALL" },
  { UNAME: "USER3", PROFL: "HR_MGR" },
];

export const MOCK_TABLES = {
  PA0000: pa0000, PA0001: pa0001, T500P: t500p, T001: t001, HRPY_RGDIR: hrpy,
  T582A: pa_t582a, T777D: t777d, T591A: t591a, T582S: t582s,
  T588M: pa_t588m, T588Z: pa_t588z,
  T778O: om_t778o, T778V: om_t778v, T778A: om_t778a,
  HRP1000: om_hrp1000, HRP1001: om_hrp1001, T778P: om_t778p,
  T77PQ: om_t77pq, T77UA: om_t77ua,
};
