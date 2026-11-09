import { Router } from "express";
import { asyncHandler } from "../../shared/middleware/errorHandler.js";
import * as c from "./headcount.controller.js";

const router = Router();

// --- sync control (no auto-refresh here) ---------------------------------
// The frontend calls POST /sync once when the app opens, waits for it, then loads the KPI endpoints.
router.post("/sync", asyncHandler(c.postSync));
router.get("/sync/status", asyncHandler(c.getSyncStatus));

// --- KPI reads (the first one after a server start triggers a live SAP fetch) ---
router.use(c.ensureFresh);

router.get("/overview", asyncHandler(c.getOverview));
router.get("/status-summary", asyncHandler(c.getStatus));
router.get("/by-country", asyncHandler(c.getByCountry));
router.get("/by-company-code", asyncHandler(c.getByCompanyCode));
router.get("/employees", asyncHandler(c.getEmployees));
router.get("/payroll-by-month", asyncHandler(c.getPayroll));
router.get("/hires-per-year", asyncHandler(c.getHires));

export default router;
