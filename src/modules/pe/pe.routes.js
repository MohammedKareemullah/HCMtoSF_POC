import { Router } from "express";
import { asyncHandler } from "../../shared/middleware/errorHandler.js";
import * as c from "./pe.controller.js";

const router = Router();

// --- sync control ----------------------------------------------------------
router.post("/sync", asyncHandler(c.postSync));
router.get("/sync/status", asyncHandler(c.getSyncStatus));

// --- KPI reads (first read after server start pulls from SAP via MCP) ------
router.use(c.ensureFresh);

// 1. Standard vs custom Payroll Area from T549A
router.get(["/payroll-area-summary", "/payroll-areas", "/payroll-area"], asyncHandler(c.getPayrollAreaSummary));

// 2. Standard vs custom Period Parameter from T549R
router.get(["/period-parameter-summary", "/period-parameters", "/period-parameter"], asyncHandler(c.getPeriodParameterSummary));

// 3. Employees per payroll area from PA0001
router.get(["/employees-per-payroll-area", "/employees-by-payroll-area"], asyncHandler(c.getEmployeesPerPayrollArea));

// 4. Payroll areas per period parameter from T549A + T549N
router.get(["/payroll-areas-per-period", "/payroll-areas-by-period"], asyncHandler(c.getPayrollAreasPerPeriod));

// 5. Company features summary from T549B (std) + T549C (custom)
router.get(["/company-features-summary", "/company-features"], asyncHandler(c.getCompanyFeaturesSummary));

// 6. Feature functions from T549D (FUNID = 'P')
router.get(["/feature-functions", "/features-functions"], asyncHandler(c.getFeatureFunctions));

// 7. Standard vs custom Wage Types from T512W
router.get(["/wage-type-summary", "/wage-types-summary", "/wage-types"], asyncHandler(c.getWageTypeSummary));

// 8. Wage types per country from T512W + T500L
router.get(["/wage-types-per-country", "/wage-types-by-country"], asyncHandler(c.getWageTypesPerCountry));

// 9. Active wage types from PA0008, PA0014, PA0015, PA0267 + T512T
router.get(["/active-wage-types", "/wage-types/active"], asyncHandler(c.getActiveWageTypes));

// 10. Standard vs custom payroll schemas from T52C0 and T52C1
router.get(["/payroll-schema-summary", "/payroll-schemas"], asyncHandler(c.getPayrollSchemaSummary));

// 11. Subschemas per payroll schema (FUNCO = 'COPY') from T52C0 and T52C1
router.get(["/payroll-schema-subschemas", "/schema-subschemas"], asyncHandler(c.getPayrollSchemaSubschemas));

// 12. Standard vs custom Personnel Calculation Rules from T52C5
router.get(["/pcr-summary", "/personnel-calculation-rules"], asyncHandler(c.getPcrSummary));

// 13. Standard vs custom payroll functions and operations from T52A0
router.get(["/payroll-functions-operations-summary", "/functions-operations-summary"], asyncHandler(c.getPayrollFunctionsOperationsSummary));

// 14. Custom functions and operations (ONAME starts with Z or Y) from T52A0
router.get(["/custom-functions-operations", "/custom-functions"], asyncHandler(c.getCustomFunctionsOperations));

// 15. Unused payroll areas: in T599B but not active in HRPY_RGDIR (last 24 months)
router.get(["/unused-payroll-areas"], asyncHandler(c.getUnusedPayrollAreas));

export default router;

