import { env } from "../../config/env.js";
import { SyncCoordinator } from "../../shared/sync/syncCoordinator.js";
import {
  startRun,
  finishRun,
  failRun,
  getLastSuccess,
  getLatestRun,
} from "../../shared/sync/syncRuns.repository.js";
import { MODULE_NAME } from "./om.constants.js";
import { fetchOmSource } from "./om.fetcher.js";
import { replaceStaging } from "./om.loader.js";
import * as repo from "./om.repository.js";
import * as processor from "./om.processor.js";

// ---------------------------------------------------------------------------
// Sync: SAP (via MCP) -> Postgres staging tables
// ---------------------------------------------------------------------------

export async function syncOm() {
  const run = await startRun(MODULE_NAME);
  const started = Date.now();
  try {
    const source = await fetchOmSource();
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
  runSync: syncOm,
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

export async function getObjectTypesSummary() {
  return processor.buildObjectTypesSummary(await repo.getObjectTypesSummary());
}

export async function getRelationshipsSummary() {
  return processor.buildRelationshipsSummary(await repo.getRelationshipsSummary());
}

export async function getEvaluationPathsSummary() {
  return processor.buildEvaluationPathsSummary(await repo.getEvaluationPathsSummary());
}

export async function getObjectsPerPlanVersion() {
  return processor.buildObjectsPerPlanVersion(await repo.getObjectsPerPlanVersion());
}

export async function getRelationshipsPerPlanVersion() {
  return processor.buildRelationshipsPerPlanVersion(await repo.getRelationshipsPerPlanVersion());
}

export async function getAuthProfilesSummary() {
  return processor.buildAuthProfilesSummary(await repo.getAuthProfilesSummary());
}

