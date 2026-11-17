import { query } from "../../config/db.js";
import { STAGING_TABLE } from "./header.constants.js";

/**
 * Read the staged RFC_GET_SYSTEM_INFO record.
 * @returns {Promise<{rfcsysid: string|null, rfcopsys: string|null, rfcdbsys: string|null, rfcdest: string|null}|null>}
 */
export async function getSystemInfo() {
  const { rows } = await query(
    `SELECT rfcsysid, rfcopsys, rfcdbsys, rfcdest
     FROM ${STAGING_TABLE}
     LIMIT 1`,
  );
  return rows[0] ?? null;
}

