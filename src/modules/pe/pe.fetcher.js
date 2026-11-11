import { env } from "../../config/env.js";
import { readSapTable } from "../../integrations/mcp/sapTableReader.js";
import { mapLimit } from "../../shared/utils/concurrency.js";
import { getSourceTables } from "./pe.constants.js";

/**
 * Pull every SAP table this KPI section needs through the MCP server.
 * Returns raw records keyed by table key: { t549a: [...], t549r: [...], ... }
 */
export async function fetchPeSource() {
  const defs = getSourceTables();
  const entries = await mapLimit(defs, env.sync.concurrency, async (def) => {
    const rows = await readSapTable({
      table: def.sap,
      fields: def.columns.map((c) => c.sap),
      pageSize: env.sync.pageSize,
      maxPages: env.sync.maxPages,
    });
    return [def.key, rows];
  });
  return Object.fromEntries(entries);
}

