import { env } from "../../config/env.js";
import { SyncCoordinator } from "../../shared/sync/syncCoordinator.js";
import {
  startRun,
  finishRun,
  failRun,
  getLastSuccess,
  getLatestRun,
} from "../../shared/sync/syncRuns.repository.js";
import { MODULE_NAME } from "./pa.constants.js";
import { fetchPaSource } from "./pa.fetcher.js";
import { replaceStaging } from "./pa.loader.js";
import * as repo from "./pa.repository.js";
import * as processor from "./pa.processor.js";

// ---------------------------------------------------------------------------
// Sync: SAP (via MCP) -> Postgres staging tables
// ---------------------------------------------------------------------------

export async function syncPa() {
  const run = await startRun(MODULE_NAME);
  const started = Date.now();
  try {
    const source = await fetchPaSource();
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
  runSync: syncPa,
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
// KPI reads: Postgres -> processor -> response shape
// ---------------------------------------------------------------------------

export async function getSingleScreenClassification() {
  return processor.buildSingleScreenClassification(await repo.getScreenClassifications());
}

export async function getListScreenClassification() {
  return processor.buildListScreenClassification(await repo.getScreenClassifications());
}

export async function getModulePoolMapping() {
  return processor.buildModulePoolMapping(await repo.getModulePoolMapping());
}

export async function getFieldVisibilitySummary() {
  return processor.buildFieldVisibilitySummary(await repo.getFieldVisibilitySummary());
}

export async function getDynamicActionCount() {
  return processor.buildDynamicActionCount(await repo.getDynamicActionCount());
}

export async function getDynamicActionTriggers() {
  return processor.buildDynamicActionTriggers(await repo.getDynamicActionTriggers());
}

export async function getDynamicActionByOperation() {
  return processor.buildDynamicActionByOperation(await repo.getDynamicActionByOperation());
}

export async function getDynamicActionRoutines() {
  return processor.buildDynamicActionRoutines(await repo.getDynamicActionRoutines());
}

