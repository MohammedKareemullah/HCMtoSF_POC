import { getLastSuccess } from "../../shared/sync/syncRuns.repository.js";
import { MODULE_NAME } from "./om.constants.js";
import * as service from "./om.service.js";

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

export async function getObjectTypes(req, res) {
  respond(req, res, await service.getObjectTypesSummary());
}

export async function getRelationships(req, res) {
  respond(req, res, await service.getRelationshipsSummary());
}

export async function getEvaluationPaths(req, res) {
  respond(req, res, await service.getEvaluationPathsSummary());
}

export async function getObjectsPerPlanVersion(req, res) {
  respond(req, res, await service.getObjectsPerPlanVersion());
}

export async function getRelationshipsPerPlanVersion(req, res) {
  respond(req, res, await service.getRelationshipsPerPlanVersion());
}

export async function getAuthProfiles(req, res) {
  respond(req, res, await service.getAuthProfilesSummary());
}

