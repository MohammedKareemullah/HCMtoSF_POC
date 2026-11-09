import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import { env } from "../config/env.js";
import { pool, withTransaction, closePool } from "../config/db.js";

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

/** Create the target database if it does not exist (needs CREATEDB rights). */
export async function ensureDatabase() {
  const { database, adminDatabase, ...rest } = env.db;
  const admin = new pg.Client({ ...rest, database: adminDatabase });
  try {
    await admin.connect();
  } catch (err) {
    throw new Error(
      `Database "${database}" does not exist and the maintenance database "${adminDatabase}" ` +
        `at ${rest.host}:${rest.port} is not reachable as ${rest.user}: ${err.message}. ` +
        `Create the database manually (createdb ${database}) or fix the credentials.`
    );
  }
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (!rowCount) {
      await admin.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
      console.log(`[db] created database "${database}"`);
    }
  } finally {
    await admin.end();
  }
}

async function ensureReachable() {
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    if (err.code === "3D000") {
      await ensureDatabase(); // database does not exist yet
      return;
    }
    throw err;
  }
}

/** Apply every not-yet-applied .sql file in db/migrations, in filename order. */
export async function runMigrations() {
  await ensureReachable();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await pool.query("SELECT name FROM schema_migrations");
  const done = new Set(rows.map((r) => r.name));

  const applied = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    });
    applied.push(file);
    console.log(`[db] applied migration ${file}`);
  }
  return applied;
}

// CLI: `npm run db:setup`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations()
    .then((applied) => {
      console.log(applied.length ? `[db] done (${applied.length} applied)` : "[db] already up to date");
    })
    .catch((err) => {
      console.error("[db] migration failed:", err.message);
      process.exitCode = 1;
    })
    .finally(() => closePool());
}
