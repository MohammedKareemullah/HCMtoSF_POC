import { Router } from "express";
import { asyncHandler } from "../../shared/middleware/errorHandler.js";
import * as c from "./hcm_core.controller.js";

const router = Router();

// --- sync control (no auto-refresh here) ---------------------------------
router.post("/sync", asyncHandler(c.postSync));
router.get("/sync/status", asyncHandler(c.getSyncStatus));

// --- KPI reads (the first one after a server start triggers a live SAP fetch) ---
router.use(c.ensureFresh);

// KPI 1: infotype count per category
router.get("/infotype-categories", asyncHandler(c.getInfotypeCategorySummary));

// KPI 2: subtype count per infotype
router.get("/subtypes-per-infotype", asyncHandler(c.getSubtypeCountsPerInfotype));

// KPI 3: full detail table (infotype, subtype, category, infotype text)
router.get("/infotype-detail", asyncHandler(c.getInfotypeSubtypeTable));

export default router;

