import { getLastSuccess } from "../../shared/sync/syncRuns.repository.js";
import { MODULE_NAME } from "./pe.constants.js";
import * as service from "./pe.service.js";

/**
 * Runs before every KPI read: makes sure data was pulled from SAP at least once since the
 * server started (or on ?refresh=true), then records freshness info for the response envelope.
 */
export async function ensureFresh(req, res, next) {
  try {
    const force = req.query.refresh === "true";
    const freshness = await service.coordinator.ensureFresh({ force });
    const last = await getLastSuccess(MODULE_NAME);
    req.syncMeta = { lastSyncedAt: last?.finishedAt ?? null, ...freshness };
    next();
  } catch (err) {
    next(err);
  }
}

/** Wraps a KPI payload in { data, meta } with sync freshness info. */
const respond = (req, res, data) => res.json({ data, meta: req.syncMeta });

export async function postSync(req, res) {
  const result = await service.coordinator.run();
  res.json({ data: result });
}

export async function getSyncStatus(req, res) {
  res.json({ data: await service.getSyncStatus() });
}

export async function getPayrollAreaSummary(req, res) {
  respond(req, res, await service.getPayrollAreaSummary());
}

export async function getPeriodParameterSummary(req, res) {
  respond(req, res, await service.getPeriodParameterSummary());
}

export async function getEmployeesPerPayrollArea(req, res) {
  respond(req, res, await service.getEmployeesPerPayrollArea());
}

export async function getPayrollAreasPerPeriod(req, res) {
  respond(req, res, await service.getPayrollAreasPerPeriod());
}

export async function getCompanyFeaturesSummary(req, res) {
  respond(req, res, await service.getCompanyFeaturesSummary());
}

export async function getFeatureFunctions(req, res) {
  respond(req, res, await service.getFeatureFunctions());
}

export async function getWageTypeSummary(req, res) {
  respond(req, res, await service.getWageTypeSummary());
}

export async function getWageTypesPerCountry(req, res) {
  respond(req, res, await service.getWageTypesPerCountry());
}

export async function getActiveWageTypes(req, res) {
  respond(req, res, await service.getActiveWageTypes());
}

export async function getPayrollSchemaSummary(req, res) {
  respond(req, res, await service.getPayrollSchemaSummary());
}

export async function getPayrollSchemaSubschemas(req, res) {
  respond(req, res, await service.getPayrollSchemaSubschemas());
}

export async function getPcrSummary(req, res) {
  respond(req, res, await service.getPcrSummary());
}

export async function getPayrollFunctionsOperationsSummary(req, res) {
  respond(req, res, await service.getPayrollFunctionsOperationsSummary());
}

export async function getCustomFunctionsOperations(req, res) {
  respond(req, res, await service.getCustomFunctionsOperations());
}

export async function getUnusedPayrollAreas(req, res) {
  respond(req, res, await service.getUnusedPayrollAreas());
}

