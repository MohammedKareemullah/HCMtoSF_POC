import { getLastSuccess } from "../../shared/sync/syncRuns.repository.js";
import { MODULE_NAME } from "./tm.constants.js";
import * as service from "./tm.service.js";

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

export async function getWorkScheduleRules(req, res) {
  respond(req, res, await service.getWorkScheduleRules());
}

export async function getDailyWorkSchedules(req, res) {
  respond(req, res, await service.getDailyWorkSchedules());
}

export async function getPeriodWorkSchedules(req, res) {
  respond(req, res, await service.getPeriodWorkSchedules());
}

export async function getWorkScheduleMapping(req, res) {
  respond(req, res, await service.getWorkScheduleMapping());
}

export async function getBreakSchedules(req, res) {
  respond(req, res, await service.getBreakSchedules());
}

export async function getOvertimeSchedules(req, res) {
  respond(req, res, await service.getOvertimeSchedules());
}

export async function getModifierSchedules(req, res) {
  respond(req, res, await service.getModifierSchedules());
}

export async function getAttendanceAbsenceTypes(req, res) {
  respond(req, res, await service.getAttendanceAbsenceTypes());
}

export async function getUnusedAbsenceTypes(req, res) {
  respond(req, res, await service.getUnusedAbsenceTypes());
}

export async function getUnusedAttendanceTypes(req, res) {
  respond(req, res, await service.getUnusedAttendanceTypes());
}

