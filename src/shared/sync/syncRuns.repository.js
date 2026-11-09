import { query } from "../../config/db.js";

const toRun = (r) =>
  r && {
    id: r.id,
    module: r.module,
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    durationMs: r.duration_ms,
    rowCounts: r.row_counts,
    error: r.error,
  };

export async function startRun(module) {
  const { rows } = await query(
    "INSERT INTO sync_runs (module, status) VALUES ($1, 'running') RETURNING *",
    [module]
  );
  return toRun(rows[0]);
}

export async function finishRun(id, rowCounts, durationMs) {
  const { rows } = await query(
    `UPDATE sync_runs
        SET status = 'success', finished_at = now(), duration_ms = $2, row_counts = $3
      WHERE id = $1 RETURNING *`,
    [id, durationMs, JSON.stringify(rowCounts)]
  );
  return toRun(rows[0]);
}

export async function failRun(id, error, durationMs) {
  const { rows } = await query(
    `UPDATE sync_runs
        SET status = 'failed', finished_at = now(), duration_ms = $2, error = $3
      WHERE id = $1 RETURNING *`,
    [id, durationMs, String(error).slice(0, 2000)]
  );
  return toRun(rows[0]);
}

export async function getLastSuccess(module) {
  const { rows } = await query(
    "SELECT * FROM sync_runs WHERE module = $1 AND status = 'success' ORDER BY id DESC LIMIT 1",
    [module]
  );
  return toRun(rows[0]) ?? null;
}

export async function getLatestRun(module) {
  const { rows } = await query("SELECT * FROM sync_runs WHERE module = $1 ORDER BY id DESC LIMIT 1", [module]);
  return toRun(rows[0]) ?? null;
}

/** Runs left in 'running' by a crashed/stopped process can never finish; close them out at startup. */
export async function failInterruptedRuns() {
  await query(
    `UPDATE sync_runs
        SET status = 'failed', finished_at = now(), error = 'Interrupted (server restarted)'
      WHERE status = 'running'`
  );
}
