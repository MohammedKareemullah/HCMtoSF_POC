export const MODULE_NAME = "om";

/**
 * SAP tables this KPI section reads and the Postgres staging table each one lands in.
 */
export function getSourceTables() {
  return [
    {
      key: "t778o",
      sap: "T778O",
      pg: "om_t778o",
      required: ["otype"],
      columns: [
        { sap: "OTYPE", name: "otype", type: "text" },
      ],
    },
    {
      key: "t778v",
      sap: "T778V",
      pg: "om_t778v",
      required: ["relat"],
      columns: [
        { sap: "RELAT", name: "relat", type: "text" },
      ],
    },
    {
      key: "t778a",
      sap: "T778A",
      pg: "om_t778a",
      required: ["wegid"],
      columns: [
        { sap: "WEGID", name: "wegid", type: "text" },
      ],
    },
    {
      key: "hrp1000",
      sap: "HRP1000",
      pg: "om_hrp1000",
      required: ["otype", "plvar"],
      columns: [
        { sap: "OTYPE", name: "otype", type: "text" },
        { sap: "PLVAR", name: "plvar", type: "text" },
      ],
    },
    {
      key: "hrp1001",
      sap: "HRP1001",
      pg: "om_hrp1001",
      required: ["relat", "plvar"],
      columns: [
        { sap: "RELAT", name: "relat", type: "text" },
        { sap: "PLVAR", name: "plvar", type: "text" },
      ],
    },
    {
      key: "t778p",
      sap: "T778P",
      pg: "om_t778p",
      required: ["plvar"],
      columns: [
        { sap: "PLVAR", name: "plvar", type: "text" },
        { sap: "PTEXT", name: "ptext", type: "text" },
      ],
    },
    {
      key: "t77pq",
      sap: "T77PQ",
      pg: "om_t77pq",
      required: ["profl"],
      columns: [
        { sap: "PROFL", name: "profl", type: "text" },
      ],
    },
    {
      key: "t77ua",
      sap: "T77UA",
      pg: "om_t77ua",
      required: ["profl"],
      columns: [
        { sap: "UNAME", name: "uname", type: "text" },
        { sap: "PROFL", name: "profl", type: "text" },
      ],
    },
  ];
}

