import { Router } from "express";
import { asyncHandler } from "../../shared/middleware/errorHandler.js";
import * as c from "./pa.controller.js";

const router = Router();

// --- sync control ----------------------------------------------------------
router.post("/sync", asyncHandler(c.postSync));
router.get("/sync/status", asyncHandler(c.getSyncStatus));

// --- KPI reads (first read after server start pulls from SAP via MCP) ------
router.use(c.ensureFresh);

// 1. Single screen & list screen classifications
router.get("/single-screen-classification", asyncHandler(c.getSingleScreenClassification));
router.get("/list-screen-classification", asyncHandler(c.getListScreenClassification));

// 2. Module pool mapping (REPNA where DYNNR != ADYNR mapped to T777D INFTY)
router.get("/module-pool-mapping", asyncHandler(c.getModulePoolMapping));

// 3. Field visibility summary (DBILD indicator symbols per infotype)
router.get("/field-visibility-summary", asyncHandler(c.getFieldVisibilitySummary));

// 4. Dynamic action count per infotype
router.get("/dynamic-action-count", asyncHandler(c.getDynamicActionCount));

// 5. Dynamic action triggers (KENNZ = 'I' with target infotype & optional 'W' line default)
router.get("/dynamic-action-triggers", asyncHandler(c.getDynamicActionTriggers));

// 6. Dynamic actions grouped by OPERA operation code
router.get("/dynamic-action-by-operation", asyncHandler(c.getDynamicActionByOperation));

// 7. Dynamic action routines (KENNZ = 'F', routine name inside parentheses)
router.get("/dynamic-action-routines", asyncHandler(c.getDynamicActionRoutines));

export default router;

