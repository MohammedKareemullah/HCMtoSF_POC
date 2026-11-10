import { getLastSuccess } from "../../shared/sync/syncRuns.repository.js";
import { MODULE_NAME } from "./pa.constants.js";
import * as service from "./pa.service.js";

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

export async function getSingleScreenClassification(req, res) {
  respond(req, res, await service.getSingleScreenClassification());
}

export async function getListScreenClassification(req, res) {
  respond(req, res, await service.getListScreenClassification());
}

export async function getModulePoolMapping(req, res) {
  respond(req, res, await service.getModulePoolMapping());
}

export async function getFieldVisibilitySummary(req, res) {
  respond(req, res, await service.getFieldVisibilitySummary());
}

export async function getDynamicActionCount(req, res) {
  respond(req, res, await service.getDynamicActionCount());
}

export async function getDynamicActionTriggers(req, res) {
  respond(req, res, await service.getDynamicActionTriggers());
}

export async function getDynamicActionByOperation(req, res) {
  respond(req, res, await service.getDynamicActionByOperation());
}

export async function getDynamicActionRoutines(req, res) {
  respond(req, res, await service.getDynamicActionRoutines());
}

