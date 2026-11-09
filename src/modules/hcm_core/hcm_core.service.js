import { env } from "../../config/env.js";
import { SyncCoordinator } from "../../shared/sync/syncCoordinator.js";
import { startRun, finishRun, failRun, getLastSuccess, getLatestRun } from "../../shared/sync/syncRuns.repository.js";
import { MODULE_NAME } from "./hcm_core.constants.js";
import { fetchHcmCoreSource } from "./hcm_core.fetcher.js";
import { replaceStaging } from "./hcm_core.loader.js";
import * as repo from "./hcm_core.repository.js";
import * as processor from "./hcm_core.processor.js";

// ---------------------------------------------------------------------------
// Sync: SAP (via MCP) -> Postgres staging tables
// ---------------------------------------------------------------------------

export async function syncHcmCore() {
  const run = await startRun(MODULE_NAME);
  const started = Date.now();
  try {
    const source = await fetchHcmCoreSource();     // 1. read everything from SAP first
    const rowCounts = await replaceStaging(source); // 2. then swap it into Postgres atomically
    const done = await finishRun(run.id, rowCounts, Date.now() - started);
    return { runId: done.id, status: done.status, rowCounts, durationMs: done.durationMs, finishedAt: done.finishedAt };
  } catch (err) {
    await failRun(run.id, err.message, Date.now() - started).catch(() => {});
    throw err;
  }
}

export const coordinator = new SyncCoordinator({
  runSync: syncHcmCore,
  getLastSuccess: () => getLastSuccess(MODULE_NAME),
  cooldownMs: env.sync.retryCooldownMs,
});

export async function getSyncStatus() {
  const [lastSuccess, latestRun] = await Promise.all([getLastSuccess(MODULE_NAME), getLatestRun(MODULE_NAME)]);
  return {
    syncing: coordinator.isRunning,
    syncedSinceServerStart: coordinator.syncedThisProcess,
    lastSuccess,
    latestRun,
  };
}

// ---------------------------------------------------------------------------
// KPI reads: Postgres -> processor -> frontend shape
// ---------------------------------------------------------------------------

export async function getInfotypeCategorySummary() {
  return processor.buildInfotypeCategorySummary(await repo.getDistinctInfotypes());
}

export async function getSubtypeCountsPerInfotype() {
  return processor.buildSubtypeCountsPerInfotype(await repo.getSubtypeCountsPerInfotype());
}

export async function getInfotypeSubtypeTable() {
  return processor.buildInfotypeSubtypeTable(await repo.getInfotypeSubtypeTable());
}

