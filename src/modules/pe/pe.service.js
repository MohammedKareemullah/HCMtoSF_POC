import { env } from "../../config/env.js";
import { SyncCoordinator } from "../../shared/sync/syncCoordinator.js";
import {
  startRun,
  finishRun,
  failRun,
  getLastSuccess,
  getLatestRun,
} from "../../shared/sync/syncRuns.repository.js";
import { MODULE_NAME } from "./pe.constants.js";
import { fetchPeSource } from "./pe.fetcher.js";
import { replaceStaging } from "./pe.loader.js";
import * as repo from "./pe.repository.js";
import * as processor from "./pe.processor.js";

// ---------------------------------------------------------------------------
// Sync: SAP (via MCP) -> Postgres staging tables
// ---------------------------------------------------------------------------

export async function syncPe() {
  const run = await startRun(MODULE_NAME);
  const started = Date.now();
  try {
    const source = await fetchPeSource();
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
  runSync: syncPe,
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

export async function getPayrollAreaSummary() {
  return processor.buildPayrollAreaSummary(await repo.getPayrollAreaSummary());
}

export async function getPeriodParameterSummary() {
  return processor.buildPeriodParameterSummary(await repo.getPeriodParameterSummary());
}

export async function getEmployeesPerPayrollArea() {
  return processor.buildEmployeesPerPayrollArea(await repo.getEmployeesPerPayrollArea());
}

export async function getPayrollAreasPerPeriod() {
  return processor.buildPayrollAreasPerPeriod(await repo.getPayrollAreasPerPeriod());
}

export async function getCompanyFeaturesSummary() {
  return processor.buildCompanyFeaturesSummary(await repo.getCompanyFeaturesSummary());
}

export async function getFeatureFunctions() {
  return processor.buildFeatureFunctions(await repo.getFeatureFunctions());
}

export async function getWageTypeSummary() {
  return processor.buildWageTypeSummary(await repo.getWageTypeSummary());
}

export async function getWageTypesPerCountry() {
  return processor.buildWageTypesPerCountry(await repo.getWageTypesPerCountry());
}

export async function getActiveWageTypes() {
  return processor.buildActiveWageTypes(await repo.getActiveWageTypes());
}

export async function getPayrollSchemaSummary() {
  return processor.buildPayrollSchemaSummary(await repo.getPayrollSchemaSummary());
}

export async function getPayrollSchemaSubschemas() {
  return processor.buildPayrollSchemaSubschemas(await repo.getPayrollSchemaSubschemas());
}

export async function getPcrSummary() {
  return processor.buildPcrSummary(await repo.getPcrSummary());
}

export async function getPayrollFunctionsOperationsSummary() {
  return processor.buildPayrollFunctionsOperationsSummary(
    await repo.getPayrollFunctionsOperationsSummary()
  );
}

export async function getCustomFunctionsOperations() {
  return processor.buildCustomFunctionsOperations(await repo.getCustomFunctionsOperations());
}

export async function getUnusedPayrollAreas() {
  return processor.buildUnusedPayrollAreas(await repo.getUnusedPayrollAreas());
}

