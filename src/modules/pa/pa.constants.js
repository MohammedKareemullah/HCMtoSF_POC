export const MODULE_NAME = "pa";

// ---------------------------------------------------------------------------
// Screen classification ranges for EDYNR (single screen)
// ---------------------------------------------------------------------------
export const EDYNR_CATEGORIES = [
  { label: "Universal Standard", exact: 2000 },
  { label: "Country Specific",   min: 2001, max: 2899 },
  { label: "Fast Entry Screens", min: 2900, max: 2999 },
  { label: "Custom",             min: 100,  max: 999  },
  { label: "Custom",             min: 9000, max: 9999 },
];

// ---------------------------------------------------------------------------
// Screen classification ranges for LDYNR (list screen)
// ---------------------------------------------------------------------------
export const LDYNR_CATEGORIES = [
  { label: "Universal Standard", exact: 3000 },
  { label: "Country Specific",   min: 3001, max: 3999 },
  { label: "Custom",             min: 100,  max: 999  },
  { label: "Custom",             min: 9000, max: 9999 },
];

// ---------------------------------------------------------------------------
// OPERA code descriptions
// ---------------------------------------------------------------------------
export const OPERA_LABELS = {
  "00": "Independent of the current function carried out",
  "02": "Change",
  "04": "Create",
  "06": "Change and create",
  "08": "Delete",
  "10": "Change and delete",
  "12": "Create and delete",
};

/**
 * Classify a screen number string against the given category table.
 * Returns "Others" for anything that does not match.
 * @param {string|null|undefined} value - raw SAP field value
 * @param {Array}                 categories - EDYNR_CATEGORIES or LDYNR_CATEGORIES
 */
export function classifyScreen(value, categories) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return "Others";
  for (const cat of categories) {
    if (cat.exact !== undefined && n === cat.exact) return cat.label;
    if (cat.min !== undefined && n >= cat.min && n <= cat.max) return cat.label;
  }
  return "Others";
}

/**
 * SAP tables this KPI section reads and the Postgres staging table each one lands in.
 */
export function getSourceTables() {
  return [
    {
      key: "t582a",
      sap: "T582A",
      pg: "pa_t582a",
      required: ["infty"],
      columns: [
        { sap: "INFTY", name: "infty", type: "text" },
        { sap: "EDYNR", name: "edynr", type: "text" },
        { sap: "LDYNR", name: "ldynr", type: "text" },
      ],
    },
    {
      key: "t777d",
      sap: "T777D",
      pg: "pa_t777d",
      required: ["infty"],
      columns: [
        { sap: "INFTY", name: "infty", type: "text" },
        { sap: "REPID", name: "repid", type: "text" },
      ],
    },
    {
      key: "t588m",
      sap: "T588M",
      pg: "pa_t588m",
      required: ["repna"],
      columns: [
        { sap: "REPNA", name: "repna", type: "text" },
        { sap: "DYNNR", name: "dynnr", type: "text" },
        { sap: "ADYNR", name: "adynr", type: "text" },
        { sap: "DBILD", name: "dbild", type: "text" },
      ],
    },
    {
      key: "t588z",
      sap: "T588Z",
      pg: "pa_t588z",
      required: ["infty"],
      columns: [
        { sap: "INFTY", name: "infty", type: "text" },
        { sap: "SUBTY", name: "subty", type: "text" },
        { sap: "FNAME", name: "fname", type: "text" },
        { sap: "OPERA", name: "opera", type: "text" },
        { sap: "SEQNO", name: "seqno", type: "text" },
        { sap: "KENNZ", name: "kennz", type: "text" },
        { sap: "VINFO", name: "vinfo", type: "text" },
      ],
    },
  ];
}

