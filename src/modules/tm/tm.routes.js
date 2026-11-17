import { Router } from "express";
import { asyncHandler } from "../../shared/middleware/errorHandler.js";
import * as c from "./tm.controller.js";

const router = Router();

// --- sync control ----------------------------------------------------------
router.post("/sync", asyncHandler(c.postSync));
router.get("/sync/status", asyncHandler(c.getSyncStatus));

// --- KPI reads (first read after server start pulls from SAP via MCP) ------
router.use(c.ensureFresh);

// 1. Count of distinct work schedule rules (SCHKZ) from T508A
router.get(["/work-schedule-rules"], asyncHandler(c.getWorkScheduleRules));

// 2. Count of distinct daily work schedules (TPROG) from T550A
router.get(["/daily-work-schedules"], asyncHandler(c.getDailyWorkSchedules));

// 3. Count of distinct period work schedules (ZMODN) from T551A
router.get(["/period-work-schedules"], asyncHandler(c.getPeriodWorkSchedules));

// 4. Nested work schedule mapping: SCHKZ -> ZMODN -> [TPROG] from T551A + T508A
router.get(["/work-schedule-mapping"], asyncHandler(c.getWorkScheduleMapping));

// 5. Daily work schedules with break times (BTBEG/BTEND/ETBEG/ETEND) mapped to ZMODN + SCHKZ
router.get(["/break-schedules"], asyncHandler(c.getBreakSchedules));

// 6. Daily work schedules with overtime/special hours (SOBEG/SOEND) mapped to ZMODN + SCHKZ
router.get(["/overtime-schedules"], asyncHandler(c.getOvertimeSchedules));

// 7. Work schedule modifiers (PAMOD from T550P) mapped via MOTPR to TPROG, ZMODN, SCHKZ
router.get(["/modifier-schedules"], asyncHandler(c.getModifierSchedules));

// 8. Standard vs custom attendance and absence subtypes from T554S
router.get(["/attendance-absence-types"], asyncHandler(c.getAttendanceAbsenceTypes));

// 9. Unused absence subtypes: in T554S (ART01='A') but no active PA2001 record (last 24 months)
router.get(["/unused-absence-types"], asyncHandler(c.getUnusedAbsenceTypes));

// 10. Unused attendance subtypes: in T554S (ART01='P') but no active PA2002 record (last 24 months)
router.get(["/unused-attendance-types"], asyncHandler(c.getUnusedAttendanceTypes));

export default router;

