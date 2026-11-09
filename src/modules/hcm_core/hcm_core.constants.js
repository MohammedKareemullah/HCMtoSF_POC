export const MODULE_NAME = "hcm_core";

/**
 * Categorise an infotype number string into its SAP functional area.
 * Ranges are taken directly from the owner's requirement.
 * Any infotype outside the documented ranges is returned as "Unknown".
 */
export const INFOTYPE_CATEGORIES = [
  { label: "Personnel Administration (PA)", min: 0,    max: 999  },
  { label: "Organizational Management (OM)", min: 1000, max: 1999 },
  { label: "Time Management (TM)",           min: 2000, max: 2999 },
  { label: "SAP Reserved",                   min: 3000, max: 3999 },
  { label: "Recruitment",                    min: 4000, max: 4999 },
  { label: "E-Recruiting & Learning",        min: 5000, max: 5999 },
  { label: "Custom Infotypes",               min: 9000, max: 9999 },
];

/**
 * Returns the category label for an infotype number.
 * @param {string|number} infty - raw INFTY value (e.g. "0001")
 */
export function categoriseInfotype(infty) {
  const n = parseInt(infty, 10);
  if (isNaN(n)) return "Unknown";
  for (const range of INFOTYPE_CATEGORIES) {
    if (n >= range.min && n <= range.max) return range.label;
  }
  return "Unknown";
}

/**
 * SAP tables this KPI section reads and the Postgres staging table each one lands in.
 * Fields match the owner's exact specification.
 */
export function getSourceTables() {
  return [
    {
      key: "t777d",
      sap: "T777D",
      pg: "hcm_t777d",
      required: ["infty"],
      columns: [
        { sap: "INFTY", name: "infty", type: "text" },
      ],
    },
    {
      key: "t591a",
      sap: "T591A",
      pg: "hcm_t591a",
      required: ["infty"],
      columns: [
        { sap: "INFTY", name: "infty", type: "text" },
        { sap: "SUBTY", name: "subty", type: "text" },
      ],
    },
    {
      key: "t582s",
      sap: "T582S",
      pg: "hcm_t582s",
      required: ["infty"],
      columns: [
        { sap: "SPRSL", name: "sprsl", type: "text" },
        { sap: "INFTY", name: "infty", type: "text" },
        { sap: "ITEXT", name: "itext", type: "text" },
      ],
    },
  ];
}

