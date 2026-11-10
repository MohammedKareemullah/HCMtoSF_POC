import { Router } from "express";
import { asyncHandler } from "../../shared/middleware/errorHandler.js";
import * as c from "./om.controller.js";

const router = Router();

// --- sync control ----------------------------------------------------------
router.post("/sync", asyncHandler(c.postSync));
router.get("/sync/status", asyncHandler(c.getSyncStatus));

// --- KPI reads (first read after server start pulls from SAP via MCP) ------
router.use(c.ensureFresh);

// 1. Standard vs custom OM Object Types from T778O
router.get(["/object-types", "/object-type-summary", "/om-objects"], asyncHandler(c.getObjectTypes));

// 2. Standard vs custom OM Relationships from T778V
router.get(["/relationships", "/relationship-summary", "/om-relationships"], asyncHandler(c.getRelationships));

// 3. Standard vs custom OM Evaluation Paths from T778A
router.get(["/evaluation-paths", "/evaluation-path-summary", "/om-evaluation-paths"], asyncHandler(c.getEvaluationPaths));

// 4. Objects per plan version from HRP1000 + T778P
router.get(["/objects-per-plan-version", "/objects-by-plan-version"], asyncHandler(c.getObjectsPerPlanVersion));

// 5. Relationships per plan version from HRP1001 + T778P
router.get(["/relationships-per-plan-version", "/relationships-by-plan-version"], asyncHandler(c.getRelationshipsPerPlanVersion));

// 6. Assigned vs unassigned structural authorization profiles from T77PQ + T77UA
router.get(["/auth-profiles", "/auth-profile-summary"], asyncHandler(c.getAuthProfiles));

export default router;

