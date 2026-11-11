export const MODULE_NAME = "pe";

/** Generate LGA01 through LGA40 column definitions for PA0008 */
const PA0008_LGA_COLUMNS = Array.from({ length: 40 }, (_, i) => {
  const num = String(i + 1).padStart(2, "0");
  return { sap: `LGA${num}`, name: `lga${num}`, type: "text" };
});

/**
 * SAP tables this KPI section reads and the Postgres staging table each one lands in.
 */
export function getSourceTables() {
  return [
    {
      key: "t549a",
      sap: "T549A",
      pg: "pe_t549a",
      required: ["abkrs"],
      columns: [
        { sap: "ABKRS", name: "abkrs", type: "text" },
        { sap: "PERMO", name: "permo", type: "text" },
      ],
    },
    {
      key: "t549r",
      sap: "T549R",
      pg: "pe_t549r",
      required: ["permo"],
      columns: [
        { sap: "PERMO", name: "permo", type: "text" },
      ],
    },
    {
      key: "pa0001",
      sap: "PA0001",
      pg: "pe_pa0001",
      required: ["pernr", "abkrs"],
      columns: [
        { sap: "PERNR", name: "pernr", type: "text" },
        { sap: "ABKRS", name: "abkrs", type: "text" },
      ],
    },
    {
      key: "t549n",
      sap: "T549N",
      pg: "pe_t549n",
      required: ["spras", "permo"],
      columns: [
        { sap: "SPRAS", name: "spras", type: "text" },
        { sap: "PERMO", name: "permo", type: "text" },
        { sap: "ATEXT", name: "atext", type: "text" },
      ],
    },
    {
      key: "t549b",
      sap: "T549B",
      pg: "pe_t549b",
      required: ["namen"],
      columns: [
        { sap: "NAMEN", name: "namen", type: "text" },
      ],
    },
    {
      key: "t549c",
      sap: "T549C",
      pg: "pe_t549c",
      required: ["namen"],
      columns: [
        { sap: "NAMEN", name: "namen", type: "text" },
      ],
    },
    {
      key: "t549d",
      sap: "T549D",
      pg: "pe_t549d",
      required: ["namen", "funid", "funct"],
      columns: [
        { sap: "NAMEN", name: "namen", type: "text" },
        { sap: "FUNID", name: "funid", type: "text" },
        { sap: "FUNCT", name: "funct", type: "text" },
      ],
    },
    {
      key: "t512w",
      sap: "T512W",
      pg: "pe_t512w",
      required: ["molga", "lgart"],
      columns: [
        { sap: "MOLGA", name: "molga", type: "text" },
        { sap: "LGART", name: "lgart", type: "text" },
      ],
    },
    {
      key: "t500t",
      sap: "T500T",
      pg: "pe_t500t",
      required: ["spras", "molga"],
      columns: [
        { sap: "SPRAS", name: "spras", type: "text" },
        { sap: "MOLGA", name: "molga", type: "text" },
        { sap: "LTEXT", name: "ltext", type: "text" },
      ],
    },
    {
      key: "pa0008",
      sap: "PA0008",
      pg: "pe_pa0008",
      required: ["begda", "endda"],
      columns: [
        { sap: "BEGDA", name: "begda", type: "date" },
        { sap: "ENDDA", name: "endda", type: "date" },
        ...PA0008_LGA_COLUMNS,
      ],
    },
    {
      key: "pa0014",
      sap: "PA0014",
      pg: "pe_pa0014",
      required: ["begda", "endda", "lgart"],
      columns: [
        { sap: "BEGDA", name: "begda", type: "date" },
        { sap: "ENDDA", name: "endda", type: "date" },
        { sap: "LGART", name: "lgart", type: "text" },
      ],
    },
    {
      key: "pa0015",
      sap: "PA0015",
      pg: "pe_pa0015",
      required: ["begda", "endda", "lgart"],
      columns: [
        { sap: "BEGDA", name: "begda", type: "date" },
        { sap: "ENDDA", name: "endda", type: "date" },
        { sap: "LGART", name: "lgart", type: "text" },
      ],
    },
    {
      key: "pa0267",
      sap: "PA0267",
      pg: "pe_pa0267",
      required: ["begda", "endda", "lgart"],
      columns: [
        { sap: "BEGDA", name: "begda", type: "date" },
        { sap: "ENDDA", name: "endda", type: "date" },
        { sap: "LGART", name: "lgart", type: "text" },
      ],
    },
    {
      key: "t512t",
      sap: "T512T",
      pg: "pe_t512t",
      required: ["sprsl", "lgart"],
      columns: [
        { sap: "SPRSL", name: "sprsl", type: "text" },
        { sap: "LGART", name: "lgart", type: "text" },
        { sap: "LGTXT", name: "lgtxt", type: "text" },
      ],
    },
    // EP10-EP11: Payroll schema tables (standard = T52C0, custom = T52C1)
    {
      key: "t52c0",
      sap: "T52C0",
      pg: "pe_t52c0",
      required: [],
      columns: [
        { sap: "SCHEM", name: "schem", type: "text" },
        { sap: "FUNCO", name: "funco", type: "text" },
        { sap: "PARM1", name: "parm1", type: "text" },
      ],
    },
    {
      key: "t52c1",
      sap: "T52C1",
      pg: "pe_t52c1",
      required: [],
      columns: [
        { sap: "SCHEM", name: "schem", type: "text" },
        { sap: "FUNCO", name: "funco", type: "text" },
        { sap: "PARM1", name: "parm1", type: "text" },
      ],
    },
    // EP12: Personnel Calculation Rules
    {
      key: "t52c5",
      sap: "T52C5",
      pg: "pe_t52c5",
      required: ["ccycl"],
      columns: [
        { sap: "CCYCL", name: "ccycl", type: "text" },
      ],
    },
    // EP13-EP14: Payroll functions and operations (from text table T52A0_T)
    {
      key: "t52a0_t",
      sap: "T52A0_T",
      pg: "pe_t52a0_t",
      required: ["oname"],
      columns: [
        { sap: "OTYPE", name: "otype", type: "text" },
        { sap: "ONAME", name: "oname", type: "text" },
        { sap: "LGTXT", name: "lgtxt", type: "text" },
      ],
    },
    // EP15: PE-specific slice of HRPY_RGDIR — only ABKRS + FPEND needed here.
    // Unused payroll areas logic maps T549A against this table.
    {
      key: "pe_hrpy_rgdir",
      sap: "HRPY_RGDIR",
      pg: "pe_hrpy_rgdir",
      required: ["abkrs"],
      columns: [
        { sap: "ABKRS", name: "abkrs", type: "text" },
        { sap: "FPEND", name: "fpend", type: "date" },
      ],
    },
    // EP15: T549T holds payroll area descriptions (ATEXT)
    {
      key: "t549t",
      sap: "T549T",
      pg: "pe_t549t",
      required: ["abkrs"],
      columns: [
        { sap: "ABKRS", name: "abkrs", type: "text" },
        { sap: "ATEXT", name: "atext", type: "text" },
      ],
    },
  ];
}

