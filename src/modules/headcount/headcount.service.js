import { env } from "../../config/env.js";
import { SyncCoordinator } from "../../shared/sync/syncCoordinator.js";
import { startRun, finishRun, failRun, getLastSuccess, getLatestRun } from "../../shared/sync/syncRuns.repository.js";
import { MODULE_NAME } from "./headcount.constants.js";
import { fetchHeadcountSource } from "./headcount.fetcher.js";
import { replaceStaging } from "./headcount.loader.js";
import * as repo from "./headcount.repository.js";
import * as processor from "./headcount.processor.js";

// ---------------------------------------------------------------------------
// Sync: SAP (via MCP) -> Postgres staging tables
// ---------------------------------------------------------------------------

export async function syncHeadcount() {
  const run = await startRun(MODULE_NAME);
  const started = Date.now();
  try {
    const source = await fetchHeadcountSource(); // 1. read everything from SAP first
    const rowCounts = await replaceStaging(source); // 2. then swap it into Postgres atomically
    const done = await finishRun(run.id, rowCounts, Date.now() - started);
    return { runId: done.id, status: done.status, rowCounts, durationMs: done.durationMs, finishedAt: done.finishedAt };
  } catch (err) {
    await failRun(run.id, err.message, Date.now() - started).catch(() => {});
    throw err;
  }
}

export const coordinator = new SyncCoordinator({
  runSync: syncHeadcount,
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

export async function getStatusSummary() {
  return processor.buildStatusSummary(await repo.getStatusCounts());
}

export async function getCountrySummary() {
  return processor.buildCountrySummary(await repo.getCountryCounts());
}

export async function getCompanyCodeSummary() {
  return processor.buildCompanySummary(await repo.getCompanyCodeCounts());
}

export async function getEmployeeTable(params) {
  const { rows, total } = await repo.getEmployees({
    ...params,
    limit: params.pageSize,
    offset: (params.page - 1) * params.pageSize,
  });
  return processor.buildEmployeePage({ rows, total }, params);
}

export async function getPayrollByMonth() {
  return processor.buildPayrollMonths(
    await repo.getPayrollEmployeesByPeriod({ srtzaFilter: env.headcount.payrollSrtzaFilter })
  );
}

export async function getHiresPerYear() {
  const massnCodes = env.headcount.hireMassnCodes;
  const [byYear, byYearAndCountry] = await Promise.all([
    repo.getHiresByYear({ massnCodes }),
    repo.getHiresByYearAndCountry({ massnCodes }),
  ]);
  return { ...processor.buildHires(byYear, byYearAndCountry), hireActionCodes: massnCodes };
}

/** Everything for the headcount dashboard in one call (the paginated employee table is separate). */
export async function getOverview() {
  const [status, byCountry, byCompanyCode, payroll, hires] = await Promise.all([
    getStatusSummary(),
    getCountrySummary(),
    getCompanyCodeSummary(),
    getPayrollByMonth(),
    getHiresPerYear(),
  ]);
  return { status, byCountry, byCompanyCode, payroll, hires };
}
