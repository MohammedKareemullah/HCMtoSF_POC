import pg from "pg";
import { env } from "./env.js";

// Return DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifting).
pg.types.setTypeParser(1082, (v) => v);
// BIGINT (e.g. BIGSERIAL ids) -> number; ids in this app stay far below 2^53.
pg.types.setTypeParser(20, (v) => Number(v));

const { adminDatabase: _admin, ...connection } = env.db;

export const pool = new pg.Pool({ ...connection, max: 10 });

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore rollback failure, surface the original error */
    }
    throw err;
  } finally {
    client.release();
  }
}

export const closePool = () => pool.end();
