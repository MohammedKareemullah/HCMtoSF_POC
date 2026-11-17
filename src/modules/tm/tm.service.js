import { env } from "../../config/env.js";
import { SyncCoordinator } from "../../shared/sync/syncCoordinator.js";
import {
  startRun,
  finishRun,
  failRun,
  getLastSuccess,
  getLatestRun,
} from "../../shared/sync/syncRuns.repository.js";
import { MODULE_NAME } from "./tm.constants.js";
import { fetchTmSource } from "./tm.fetcher.js";
import { replaceStaging } from "./tm.loader.js";
import * as repo from "./tm.repository.js";
import * as processor from "./tm.processor.js";

// ---------------------------------------------------------------------------
// Sync: SAP (via MCP) -> Postgres staging tables
// ---------------------------------------------------------------------------

export async function syncTm() {
  const run = await startRun(MODULE_NAME);
  const started = Date.now();
  try {
    const source = await fetchTmSource();
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
  runSync: syncTm,
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

export async function getWorkScheduleRules() {
  return processor.buildWorkScheduleRules(await repo.getWorkScheduleRules());
}

export async function getDailyWorkSchedules() {
  return processor.buildDailyWorkSchedules(await repo.getDailyWorkSchedules());
}

export async function getPeriodWorkSchedules() {
  return processor.buildPeriodWorkSchedules(await repo.getPeriodWorkSchedules());
}

export async function getWorkScheduleMapping() {
  return processor.buildWorkScheduleMapping(await repo.getWorkScheduleMapping());
}

export async function getBreakSchedules() {
  return processor.buildBreakSchedules(await repo.getBreakSchedules());
}

export async function getOvertimeSchedules() {
  return processor.buildOvertimeSchedules(await repo.getOvertimeSchedules());
}

export async function getModifierSchedules() {
  return processor.buildModifierSchedules(await repo.getModifierSchedules());
}

export async function getAttendanceAbsenceTypes() {
  return processor.buildAttendanceAbsenceTypes(await repo.getAttendanceAbsenceTypes());
}

export async function getUnusedAbsenceTypes() {
  return processor.buildUnusedAbsenceTypes(await repo.getUnusedAbsenceTypes());
}

export async function getUnusedAttendanceTypes() {
  return processor.buildUnusedAttendanceTypes(await repo.getUnusedAttendanceTypes());
}

