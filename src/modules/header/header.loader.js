import { withTransaction } from "../../config/db.js";
import { bulkInsert } from "../../shared/db/bulkInsert.js";
import { convertValue } from "../../shared/utils/sapValues.js";
import { STAGING_TABLE, SYSTEM_INFO_COLUMNS } from "./header.constants.js";

/**
 * Replace the header staging table with freshly fetched RFC_GET_SYSTEM_INFO data.
 * Runs in ONE transaction so previous data survives any failure.
 * @param {Record<string, unknown>} source
 * @returns {Promise<{ system_info: number }>}
 */
export async function replaceStaging(source) {
  return withTransaction(async (client) => {
    await client.query(`TRUNCATE ${STAGING_TABLE}`);

    const row = SYSTEM_INFO_COLUMNS.map((c) => convertValue(c.type, source?.[c.sap]));
    const count = await bulkInsert(client, {
      table: STAGING_TABLE,
      columns: SYSTEM_INFO_COLUMNS.map((c) => ({ name: c.name, pgType: c.type })),
      rows: [row],
    });

    return { system_info: count };
  });
}

