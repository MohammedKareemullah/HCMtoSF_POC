import { getLastSuccess } from "../../shared/sync/syncRuns.repository.js";
import { MODULE_NAME } from "./hcm_core.constants.js";
import * as service from "./hcm_core.service.js";

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

export async function getInfotypeCategorySummary(req, res) {
  respond(req, res, await service.getInfotypeCategorySummary());
}

export async function getSubtypeCountsPerInfotype(req, res) {
  respond(req, res, await service.getSubtypeCountsPerInfotype());
}

export async function getInfotypeSubtypeTable(req, res) {
  respond(req, res, await service.getInfotypeSubtypeTable());
}

