import { Router } from "express";
import { asyncHandler } from "../../shared/middleware/errorHandler.js";
import * as c from "./header.controller.js";

const router = Router();

// --- sync control ----------------------------------------------------------
router.post("/sync", asyncHandler(c.postSync));
router.get("/sync/status", asyncHandler(c.getSyncStatus));

// --- Header reads (first read after server start calls RFC_GET_SYSTEM_INFO via MCP) ---
router.use(c.ensureFresh);

router.get(["/", "/system-info"], asyncHandler(c.getSystemInfo));

export default router;

