// Header module constants — SAP system header metadata via RFC_GET_SYSTEM_INFO

export const MODULE_NAME = "header";

export const RFC_FUNCTION = "RFC_GET_SYSTEM_INFO";
export const RFC_PARAMETERS = { DESTINATION: "" };

export const STAGING_TABLE = "hdr_system_info";

export const SYSTEM_INFO_COLUMNS = [
  { sap: "RFCSYSID", name: "rfcsysid", type: "text" },
  { sap: "RFCOPSYS", name: "rfcopsys", type: "text" },
  { sap: "RFCDBSYS", name: "rfcdbsys", type: "text" },
  { sap: "RFCDEST", name: "rfcdest", type: "text" },
];

