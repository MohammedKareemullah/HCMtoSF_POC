// Pure functions: rows/data in, frontend-ready shapes out. No I/O, easy to test.

/**
 * 1. Payroll Areas: standard vs custom summary.
 * Custom = starts with 'Z' or 'Y' (case-insensitive).
 */
export function buildPayrollAreaSummary(input) {
  if (Array.isArray(input)) {
    const valid = input.map((r) => r.abkrs).filter(Boolean);
    const unique = [...new Set(valid)];
    const custom = unique.filter((a) => {
      const u = a.toUpperCase();
      return u.startsWith("Z") || u.startsWith("Y");
    }).length;
    const std = unique.length - custom;
    return { stdPayrollAreas: std, customPayrollAreas: custom, total: unique.length };
  }
  return {
    stdPayrollAreas: input?.std_payroll_areas ?? 0,
    customPayrollAreas: input?.custom_payroll_areas ?? 0,
    total: input?.total ?? 0,
  };
}

/**
 * 2. Period Parameters: standard vs custom summary.
 * Custom = numeric between 50-99.
 */
export function buildPeriodParameterSummary(input) {
  if (Array.isArray(input)) {
    const valid = input.map((r) => r.permo).filter(Boolean);
    const unique = [...new Set(valid)];
    const isCustom = (p) => {
      const n = parseInt(p, 10);
      return !isNaN(n) && String(n) === String(p).trim() && n >= 50 && n <= 99;
    };
    const custom = unique.filter(isCustom).length;
    const std = unique.length - custom;
    return { stdPeriodParameters: std, customPeriodParameters: custom, total: unique.length };
  }
  return {
    stdPeriodParameters: input?.std_period_parameters ?? 0,
    customPeriodParameters: input?.custom_period_parameters ?? 0,
    total: input?.total ?? 0,
  };
}

/**
 * 3. Employees per Payroll Area: distinct employees under each payroll area.
 */
export function buildEmployeesPerPayrollArea(rows) {
  if (rows && rows.length > 0 && (rows[0].no_of_employees !== undefined || rows[0].noOfEmployees !== undefined)) {
    const items = rows.map((r) => {
      const count = r.no_of_employees ?? r.noOfEmployees ?? 0;
      return {
        payrollArea: r.abkrs,
        noOfEmployees: count,
      };
    });
    return { total: items.length, items };
  }

  // Raw rows fallback (for unit tests): deduplicate PERNR first
  const seenPernr = new Set();
  const counts = {};
  for (const r of rows ?? []) {
    if (!r.pernr || !r.abkrs) continue;
    if (!seenPernr.has(r.pernr)) {
      seenPernr.add(r.pernr);
      counts[r.abkrs] = (counts[r.abkrs] ?? 0) + 1;
    }
  }
  const items = Object.entries(counts).map(([payrollArea, noOfEmployees]) => ({
    payrollArea,
    noOfEmployees,
  }));
  return { total: items.length, items };
}

/**
 * 4. Payroll Areas per Period Parameter.
 */
export function buildPayrollAreasPerPeriod(rows) {
  const items = (rows ?? []).map((r) => {
    const count = r.no_of_payroll_areas ?? r.noOfPayrollAreas ?? 0;
    const text = r.atext ?? r.periodParameterText ?? "NA";
    return {
      periodParameter: r.permo,
      periodParameterText: text,
      noOfPayrollAreas: count,
    };
  });
  return { total: items.length, items };
}

/**
 * 5. Company Features: standard (T549B) vs custom (T549C).
 */
export function buildCompanyFeaturesSummary(input) {
  if (input && (Array.isArray(input.t549b) || Array.isArray(input.t549c))) {
    const stdSet = new Set((input.t549b ?? []).map((r) => r.namen).filter(Boolean));
    const customSet = new Set((input.t549c ?? []).map((r) => r.namen).filter(Boolean));
    return {
      stdCompanyFeatures: stdSet.size,
      customCompanyFeatures: customSet.size,
      total: stdSet.size + customSet.size,
    };
  }
  return {
    stdCompanyFeatures: input?.std_company_features ?? 0,
    customCompanyFeatures: input?.custom_company_features ?? 0,
    total: input?.total ?? 0,
  };
}

/**
 * 6. Feature Functions: unique features, function count, and function names list.
 * Drops the number after the function name separated by space.
 */
export function buildFeatureFunctions(rows) {
  if (rows && rows.length > 0 && Array.isArray(rows[0].functions)) {
    const items = rows.map((r) => ({
      feature: r.namen,
      noOfFunctions: r.no_of_functions ?? r.functions.length,
      functions: r.functions,
    }));
    return { total: items.length, items };
  }

  // Raw rows fallback (for unit tests with raw input)
  const grouped = {};
  for (const r of rows ?? []) {
    if (r.funid !== "P" || !r.namen || !r.funct) continue;
    const func = r.funct.trim().split(/\s+/)[0];
    if (!grouped[r.namen]) grouped[r.namen] = new Set();
    grouped[r.namen].add(func);
  }
  const items = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([feature, funcs]) => {
      const arr = [...funcs].sort();
      return { feature, noOfFunctions: arr.length, functions: arr };
    });
  return { total: items.length, items };
}

/**
 * 7. Wage Types: standard vs custom summary.
 * Custom = starts with 'Z' or 'Y', or starts with digit 0-9.
 */
export function buildWageTypeSummary(input) {
  if (Array.isArray(input)) {
    const valid = input.map((r) => r.lgart).filter(Boolean);
    const unique = [...new Set(valid)];
    const isCustom = (w) => {
      const u = w.toUpperCase();
      return u.startsWith("Z") || u.startsWith("Y") || /^[0-9]/.test(u);
    };
    const custom = unique.filter(isCustom).length;
    const std = unique.length - custom;
    return { stdWageTypes: std, customWageTypes: custom, total: unique.length };
  }
  return {
    stdWageTypes: input?.std_wage_types ?? 0,
    customWageTypes: input?.custom_wage_types ?? 0,
    total: input?.total ?? 0,
  };
}

/**
 * 8. Wage Types per Country.
 */
export function buildWageTypesPerCountry(rows) {
  const items = (rows ?? []).map((r) => ({
    countryCode: r.country_code ?? r.molga,
    countryName: r.country_name ?? r.ltext ?? "NA",
    noOfWageTypes: r.no_of_wage_types ?? r.noOfWageTypes ?? 0,
  }));
  return { total: items.length, items };
}

/**
 * 9. Active Wage Types: distinct active wage types mapped to descriptions.
 */
export function buildActiveWageTypes(rows) {
  const items = (rows ?? []).map((r) => ({
    wageType: r.wage_type ?? r.lgart,
    wageTypeText: r.wage_type_text ?? r.lgtxt ?? "NA",
  }));
  return { total: items.length, items };
}

/**
 * 10. Payroll Schema Summary: standard (T52C0) vs custom (T52C1) distinct schemas.
 */
export function buildPayrollSchemaSummary(input) {
  return {
    stdPayrollSchemas: input?.std_payroll_schemas ?? 0,
    customPayrollSchemas: input?.custom_payroll_schemas ?? 0,
    total: input?.total ?? 0,
  };
}

/**
 * 11. Payroll Schema Subschemas: list of schemas with their subschema counts.
 * Input: { std: rows[], custom: rows[] } from two SQL queries.
 */
export function buildPayrollSchemaSubschemas(input) {
  const mapRows = (rows) =>
    (rows ?? []).map((r) => ({
      schema: r.schem,
      noOfSubschemas: r.no_of_subschemas ?? 0,
    }));
  const stdItems = mapRows(input?.std);
  const customItems = mapRows(input?.custom);
  return {
    std: { total: stdItems.length, items: stdItems },
    custom: { total: customItems.length, items: customItems },
  };
}

/**
 * 12. PCR Summary: standard vs custom Personnel Calculation Rules.
 * Custom = starts with Z, Y, or 9.
 */
export function buildPcrSummary(input) {
  return {
    stdPcr: input?.std_pcr ?? 0,
    customPcr: input?.custom_pcr ?? 0,
    total: input?.total ?? 0,
  };
}

/**
 * 13. Payroll Functions and Operations Summary: separate summaries for FU and OP.
 * Input: rows grouped by OTYPE from SQL.
 */
export function buildPayrollFunctionsOperationsSummary(rows) {
  const fu = (rows ?? []).find((r) => r.otype === "FU") ?? {};
  const op = (rows ?? []).find((r) => r.otype === "OP") ?? {};
  return {
    functions: {
      stdFunctions: fu.std_count ?? 0,
      customFunctions: fu.custom_count ?? 0,
      total: fu.total ?? 0,
    },
    operations: {
      stdOperations: op.std_count ?? 0,
      customOperations: op.custom_count ?? 0,
      total: op.total ?? 0,
    },
  };
}

/**
 * 14. Custom Functions and Operations: list with type label, name, description.
 * OTYPE 'FU' -> "Function", 'OP' -> "Operation".
 */
export function buildCustomFunctionsOperations(rows) {
  const TYPE_LABEL = { FU: "Function", OP: "Operation" };
  const items = (rows ?? []).map((r) => ({
    type: TYPE_LABEL[r.otype] ?? r.otype,
    name: r.oname,
    description: r.lgtxt ?? "NA",
  }));
  return { total: items.length, items };
}

/**
 * 15. Unused Payroll Areas: payroll areas from T549A not seen in HRPY_RGDIR within 24 months,
 * mapped to descriptions from T549T.
 */
export function buildUnusedPayrollAreas(rows) {
  const items = (rows ?? []).map((r) => ({
    payrollArea: r.abkrs,
    payrollAreaDesc: r.atext ?? r.payroll_area_desc ?? r.payrollAreaDesc ?? r.description ?? "NA",
  }));
  return { total: items.length, items };
}

