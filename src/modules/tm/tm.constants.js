// TM module constants — Time Management KPI section

export const MODULE_NAME = "tm";

/**
 * SAP tables this KPI section reads and the Postgres staging table each one lands in.
 */
export function getSourceTables() {
  return [
    {
      key: "t508a",
      sap: "T508A",
      pg: "tm_t508a",
      required: ["schkz"],
      columns: [
        { sap: "SCHKZ", name: "schkz", type: "text" },
        { sap: "ZMODN", name: "zmodn", type: "text" },
      ],
    },
    {
      key: "t550a",
      sap: "T550A",
      pg: "tm_t550a",
      required: ["tprog"],
      columns: [
        { sap: "TPROG", name: "tprog", type: "text" },
        { sap: "BTBEG", name: "btbeg", type: "text" },
        { sap: "BTEND", name: "btend", type: "text" },
        { sap: "ETBEG", name: "etbeg", type: "text" },
        { sap: "ETEND", name: "etend", type: "text" },
        { sap: "SOBEG", name: "sobeg", type: "text" },
        { sap: "SOEND", name: "soend", type: "text" },
        { sap: "MOTPR", name: "motpr", type: "text" },
      ],
    },
    {
      key: "t551a",
      sap: "T551A",
      pg: "tm_t551a",
      required: ["zmodn"],
      columns: [
        { sap: "ZMODN", name: "zmodn", type: "text" },
        { sap: "TPRG1", name: "tprg1", type: "text" },
        { sap: "TPRG2", name: "tprg2", type: "text" },
        { sap: "TPRG3", name: "tprg3", type: "text" },
        { sap: "TPRG4", name: "tprg4", type: "text" },
        { sap: "TPRG5", name: "tprg5", type: "text" },
        { sap: "TPRG6", name: "tprg6", type: "text" },
        { sap: "TPRG7", name: "tprg7", type: "text" },
      ],
    },
    {
      key: "t550p",
      sap: "T550P",
      pg: "tm_t550p",
      required: ["motpr"],
      columns: [
        { sap: "MOTPR", name: "motpr", type: "text" },
        { sap: "PAMOD", name: "pamod", type: "text" },
      ],
    },
    {
      key: "t554s",
      sap: "T554S",
      pg: "tm_t554s",
      required: ["subty"],
      columns: [
        { sap: "SUBTY", name: "subty", type: "text" },
        { sap: "ART01", name: "art01", type: "text" },
      ],
    },
    {
      key: "t554t",
      sap: "T554T",
      pg: "tm_t554t",
      required: ["awart"],
      columns: [
        { sap: "AWART", name: "awart", type: "text" },
        { sap: "ATEXT", name: "atext", type: "text" },
      ],
    },
    {
      key: "pa2001",
      sap: "PA2001",
      pg: "tm_pa2001",
      required: ["subty"],
      columns: [
        { sap: "SUBTY", name: "subty", type: "text" },
        { sap: "BEGDA", name: "begda", type: "date" },
        { sap: "ENDDA", name: "endda", type: "date" },
      ],
    },
    {
      key: "pa2002",
      sap: "PA2002",
      pg: "tm_pa2002",
      required: ["subty"],
      columns: [
        { sap: "SUBTY", name: "subty", type: "text" },
        { sap: "BEGDA", name: "begda", type: "date" },
        { sap: "ENDDA", name: "endda", type: "date" },
      ],
    },
  ];
}
