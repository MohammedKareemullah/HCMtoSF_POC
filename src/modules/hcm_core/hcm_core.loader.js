import { withTransaction } from "../../config/db.js";
import { bulkInsert } from "../../shared/db/bulkInsert.js";
import { convertValue } from "../../shared/utils/sapValues.js";
import { getSourceTables } from "./hcm_core.constants.js";

/**
 * Replace the staging tables with freshly fetched SAP data.
 * Everything happens in ONE transaction: if anything fails, the previous data stays untouched.
 * @returns {Promise<Record<string, number>>} rows loaded per table key
 */
export async function replaceStaging(source) {
  const defs = getSourceTables();

  return withTransaction(async (client) => {
    await client.query(`TRUNCATE ${defs.map((d) => d.pg).join(", ")}`);

    const counts = {};
    for (const def of defs) {
      const requiredIdx = def.required.map((name) => def.columns.findIndex((c) => c.name === name));

      const rows = (source[def.key] ?? [])
        .map((rec) => def.columns.map((c) => convertValue(c.type, rec[c.sap])))
        .filter((row) => requiredIdx.every((i) => row[i] !== null));

      counts[def.key] = await bulkInsert(client, {
        table: def.pg,
        columns: def.columns.map((c) => ({ name: c.name, pgType: c.type })),
        rows,
      });
    }
    return counts;
  });
}

