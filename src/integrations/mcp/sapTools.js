import { callTool } from "./mcpClient.js";

/** Verify the MCP server can reach SAP with the configured credentials. */
export const sapConnectionCheck = () => callTool("sap_connection_check", {});

/** One raw call to sap_table_read. Extra keys (rowSkips, ...) are passed through untouched. */
export function sapTableRead({ table, fields, rowCount = 5, delimiter = "|", ...rest }) {
  if (!table) throw new Error("sapTableRead: 'table' is required");
  if (!Array.isArray(fields) || !fields.length) throw new Error("sapTableRead: 'fields' must be a non-empty array");
  return callTool("sap_table_read", { table, fields, rowCount, delimiter, ...rest });
}

/** Call an RFC-enabled function module. */
export function sapFunctionCall(functionName, parameters = {}) {
  if (!functionName) throw new Error("sapFunctionCall: 'functionName' is required");
  return callTool("sap_function_call", { functionName, parameters });
}

/** Read SAP lock entries. */
export const sapLockEntries = ({ functionName = "ENQUEUE_READ", ...rest } = {}) =>
  callTool("sap_lock_entries", { functionName, ...rest });
