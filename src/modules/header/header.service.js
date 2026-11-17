import { env } from "../../config/env.js";
import { SyncCoordinator } from "../../shared/sync/syncCoordinator.js";
import {
  startRun,
  finishRun,
  failRun,
  getLastSuccess,
  getLatestRun,
} from "../../shared/sync/syncRuns.repository.js";
import { MODULE_NAME } from "./header.constants.js";
import { fetchHeaderSource } from "./header.fetcher.js";
import { replaceStaging } from "./header.loader.js";
import * as repo from "./header.repository.js";
import * as processor from "./header.processor.js";

// ---------------------------------------------------------------------------
// Sync: SAP RFC_GET_SYSTEM_INFO (via MCP) -> Postgres staging table
// ---------------------------------------------------------------------------

export async function syncHeader() {
  const run = await startRun(MODULE_NAME);
  const started = Date.now();
  try {
    const source = await fetchHeaderSource();
    const rowCounts = await replaceStaging(source);
    const done = await finishRun(run.id, rowCounts, Date.now() - started);
    return {
      runId: done.id,
      status: done.status,
      rowCounts,
      durationMs: done.durationMs,
      finishedAt: done.finishedAt,
    };
  } catch (err) {
    await failRun(run.id, err.message, Date.now() - started).catch(() => {});
    throw err;
  }
}

export const coordinator = new SyncCoordinator({
  runSync: syncHeader,
  getLastSuccess: () => getLastSuccess(MODULE_NAME),
  cooldownMs: env.sync.retryCooldownMs,
});

export async function getSyncStatus() {
  const [lastSuccess, latestRun] = await Promise.all([
    getLastSuccess(MODULE_NAME),
    getLatestRun(MODULE_NAME),
  ]);
  return {
    syncing: coordinator.isRunning,
    syncedSinceServerStart: coordinator.syncedThisProcess,
    lastSuccess,
    latestRun,
  };
}

// ---------------------------------------------------------------------------
// Header reads: Postgres -> processor -> response shape
// ---------------------------------------------------------------------------

export async function getSystemInfo() {
  return processor.buildSystemInfo(await repo.getSystemInfo());
}

