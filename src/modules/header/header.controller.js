import { getLastSuccess } from "../../shared/sync/syncRuns.repository.js";
import { MODULE_NAME } from "./header.constants.js";
import * as service from "./header.service.js";

/**
 * Runs before every header read: makes sure data was pulled from SAP at least once since
 * server start (or on ?refresh=true), then records freshness info for the response envelope.
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

const respond = (req, res, data) => res.json({ data, meta: req.syncMeta });

export async function postSync(req, res) {
  const result = await service.coordinator.run();
  res.json({ data: result });
}

export async function getSyncStatus(req, res) {
  res.json({ data: await service.getSyncStatus() });
}

export async function getSystemInfo(req, res) {
  respond(req, res, await service.getSystemInfo());
}

