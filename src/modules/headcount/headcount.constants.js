export const MODULE_NAME = "headcount";

// PA0000-STAT2 employment status. Order here = display order in the API.
export const STAT2_ORDER = ["3", "1", "2", "0"];
export const STAT2_LABELS = {
  3: "Active",
  1: "Inactive",
  2: "Retiree",
  0: "Withdrawn",
};

/**
 * The SAP tables/fields this KPI section reads, and the Postgres staging table each one lands in.
 *  - sap:  SAP field name sent to sap_table_read
 *  - name: Postgres column
 *  - type: text | date   (SAP 'YYYYMMDD' dates become real DATEs)
 *  - required: records with an empty value in these columns are skipped
 *
 * Fields beyond the ones you listed (BEGDA/ENDDA) are read so that, for employees with several
 * infotype records, the CURRENT record can be picked deterministically (latest ENDDA, then BEGDA).
 */
export function getSourceTables(cfg) {
  return [
    {
      key: "pa0000",
      sap: "PA0000",
      pg: "hc_pa0000",
      required: ["pernr"],
      columns: [
        { sap: "PERNR", name: "pernr", type: "text" },
        { sap: "BEGDA", name: "begda", type: "date" },
        { sap: "ENDDA", name: "endda", type: "date" },
        { sap: "MASSN", name: "massn", type: "text" },
        { sap: "STAT2", name: "stat2", type: "text" },
      ],
    },
    {
      key: "pa0001",
      sap: "PA0001",
      pg: "hc_pa0001",
      required: ["pernr"],
      columns: [
        { sap: "PERNR", name: "pernr", type: "text" },
        { sap: "BEGDA", name: "begda", type: "date" },
        { sap: "ENDDA", name: "endda", type: "date" },
        { sap: "BUKRS", name: "bukrs", type: "text" },
        { sap: "WERKS", name: "werks", type: "text" },
        { sap: "PERSG", name: "persg", type: "text" },
        { sap: "PERSK", name: "persk", type: "text" },
        { sap: "ABKRS", name: "abkrs", type: "text" },
      ],
    },
    {
      key: "t500p",
      sap: "T500P",
      pg: "hc_t500p",
      required: ["persa"],
      columns: [
        { sap: "PERSA", name: "persa", type: "text" },
        { sap: "LAND1", name: "land1", type: "text" },
      ],
    },
    {
      key: "t001",
      sap: "T001",
      pg: "hc_t001",
      required: ["bukrs"],
      columns: [
        { sap: "BUKRS", name: "bukrs", type: "text" },
        { sap: "BUTXT", name: "butxt", type: "text" },
      ],
    },
    {
      key: "hrpy_rgdir",
      sap: "HRPY_RGDIR",
      pg: "hc_hrpy_rgdir",
      required: ["pernr"],
      columns: [
        { sap: "PERNR", name: "pernr", type: "text" },
        { sap: "ABKRS", name: "abkrs", type: "text" },
        { sap: "FPPER", name: "fpper", type: "text" },
        { sap: "SRTZA", name: "srtza", type: "text" },
      ],
    },
  ];
}
