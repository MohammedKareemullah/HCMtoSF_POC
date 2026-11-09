import { ValidationError } from "../../shared/errors/AppError.js";
import { getLastSuccess } from "../../shared/sync/syncRuns.repository.js";
import { MODULE_NAME, STAT2_ORDER } from "./headcount.constants.js";
import * as service from "./headcount.service.js";

/**
 * Runs before every KPI read: makes sure the data was pulled from SAP at least once since the
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

export async function getStatus(req, res) {
  respond(req, res, await service.getStatusSummary());
}

export async function getByCountry(req, res) {
  respond(req, res, await service.getCountrySummary());
}

export async function getByCompanyCode(req, res) {
  respond(req, res, await service.getCompanyCodeSummary());
}

export async function getEmployees(req, res) {
  const { status, country, companyCode, search } = req.query;
  const page = parseIntParam(req.query.page, "page", 1, 1, 1_000_000);
  const pageSize = parseIntParam(req.query.pageSize, "pageSize", 50, 1, 500);

  if (status !== undefined && !STAT2_ORDER.includes(String(status))) {
    throw new ValidationError(`status must be one of ${STAT2_ORDER.join(", ")}`);
  }

  const data = await service.getEmployeeTable({
    status: status === undefined ? undefined : String(status),
    country: country ? String(country).toUpperCase() : undefined,
    companyCode: companyCode ? String(companyCode) : undefined,
    search: search ? String(search).trim() : undefined,
    page,
    pageSize,
  });
  respond(req, res, data);
}

export async function getPayroll(req, res) {
  respond(req, res, await service.getPayrollByMonth());
}

export async function getHires(req, res) {
  respond(req, res, await service.getHiresPerYear());
}

export async function getOverview(req, res) {
  respond(req, res, await service.getOverview());
}

function parseIntParam(value, name, def, min, max) {
  if (value === undefined || value === "") return def;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`${name} must be an integer between ${min} and ${max}`);
  }
  return n;
}
