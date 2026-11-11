import { query } from "../../config/db.js";

/**
 * 1. Payroll Areas: count standard (not starting with Z/Y) vs custom (starting with Z or Y)
 * from distinct non-null ABKRS in T549A.
 */
export async function getPayrollAreaSummary() {
  const { rows } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE upper(abkrs) NOT LIKE 'Z%' AND upper(abkrs) NOT LIKE 'Y%')::int AS std_payroll_areas,
       COUNT(*) FILTER (WHERE upper(abkrs) LIKE 'Z%' OR upper(abkrs) LIKE 'Y%')::int AS custom_payroll_areas,
       COUNT(*)::int AS total
     FROM (
       SELECT DISTINCT abkrs
       FROM pe_t549a
       WHERE abkrs IS NOT NULL AND abkrs <> ''
     ) t;`
  );
  return rows[0] ?? { std_payroll_areas: 0, custom_payroll_areas: 0, total: 0 };
}

/**
 * 2. Period Parameters: count standard (outside 50-99) vs custom (between 50-99)
 * from distinct non-null PERMO in T549R.
 */
export async function getPeriodParameterSummary() {
  const { rows } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE NOT (permo ~ '^[0-9]+$' AND permo::int BETWEEN 50 AND 99))::int AS std_period_parameters,
       COUNT(*) FILTER (WHERE permo ~ '^[0-9]+$' AND permo::int BETWEEN 50 AND 99)::int AS custom_period_parameters,
       COUNT(*)::int AS total
     FROM (
       SELECT DISTINCT permo
       FROM pe_t549r
       WHERE permo IS NOT NULL AND permo <> ''
     ) t;`
  );
  return rows[0] ?? { std_period_parameters: 0, custom_period_parameters: 0, total: 0 };
}

/**
 * 3. Employees per Payroll Area: distinct PERNR count per ABKRS from PA0001.
 */
export async function getEmployeesPerPayrollArea() {
  const { rows } = await query(
    `WITH dedup AS (
       SELECT DISTINCT pernr, abkrs
       FROM pe_pa0001
       WHERE pernr IS NOT NULL AND pernr <> ''
         AND abkrs IS NOT NULL AND abkrs <> ''
     )
     SELECT
       abkrs,
       COUNT(DISTINCT pernr)::int AS no_of_employees
     FROM dedup
     GROUP BY abkrs
     ORDER BY abkrs;`
  );
  return rows;
}

/**
 * 4. Payroll Areas per Period Parameter: count ABKRS per PERMO from T549A,
 * mapped to T549N ATEXT (SPRAS = 'E').
 */
export async function getPayrollAreasPerPeriod() {
  const { rows } = await query(
    `WITH texts AS (
       SELECT DISTINCT ON (permo) permo, atext
       FROM pe_t549n
       WHERE spras = 'E' AND permo IS NOT NULL
       ORDER BY permo
     ),
     counts AS (
       SELECT
         permo,
         COUNT(DISTINCT abkrs)::int AS no_of_payroll_areas
       FROM pe_t549a
       WHERE permo IS NOT NULL AND permo <> ''
         AND abkrs IS NOT NULL AND abkrs <> ''
       GROUP BY permo
     )
     SELECT
       c.permo,
       COALESCE(t.atext, 'NA') AS atext,
       c.no_of_payroll_areas
     FROM counts c
     LEFT JOIN texts t ON t.permo = c.permo
     ORDER BY c.permo;`
  );
  return rows;
}

/**
 * 5. Company Features: distinct NAMEN from T549B (std) and T549C (custom).
 */
export async function getCompanyFeaturesSummary() {
  const { rows } = await query(
    `WITH std AS (
       SELECT COUNT(DISTINCT namen)::int AS std_count
       FROM pe_t549b
       WHERE namen IS NOT NULL AND namen <> ''
     ),
     custom AS (
       SELECT COUNT(DISTINCT namen)::int AS custom_count
       FROM pe_t549c
       WHERE namen IS NOT NULL AND namen <> ''
     )
     SELECT
       std.std_count AS std_company_features,
       custom.custom_count AS custom_company_features,
       (std.std_count + custom.custom_count)::int AS total
     FROM std, custom;`
  );
  return rows[0] ?? { std_company_features: 0, custom_company_features: 0, total: 0 };
}

/**
 * 6. Feature Functions: from T549D where FUNID = 'P', group by NAMEN,
 * list unique functions (drop number suffix after space).
 */
export async function getFeatureFunctions() {
  const { rows } = await query(
    `WITH cleaned AS (
       SELECT DISTINCT
         namen,
         split_part(trim(funct), ' ', 1) AS func_name
       FROM pe_t549d
       WHERE funid = 'P'
         AND namen IS NOT NULL AND namen <> ''
         AND funct IS NOT NULL AND funct <> ''
     )
     SELECT
       namen,
       COUNT(func_name)::int AS no_of_functions,
       array_agg(func_name ORDER BY func_name) AS functions
     FROM cleaned
     GROUP BY namen
     ORDER BY namen;`
  );
  return rows;
}

/**
 * 7. Wage Types: count standard vs custom (starts with Z/Y or digit 0-9)
 * from distinct non-null LGART in T512W.
 */
export async function getWageTypeSummary() {
  const { rows } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE NOT (upper(lgart) LIKE 'Z%' OR upper(lgart) LIKE 'Y%' OR lgart ~ '^[0-9]'))::int AS std_wage_types,
       COUNT(*) FILTER (WHERE upper(lgart) LIKE 'Z%' OR upper(lgart) LIKE 'Y%' OR lgart ~ '^[0-9]')::int AS custom_wage_types,
       COUNT(*)::int AS total
     FROM (
       SELECT DISTINCT lgart
       FROM pe_t512w
       WHERE lgart IS NOT NULL AND lgart <> ''
     ) t;`
  );
  return rows[0] ?? { std_wage_types: 0, custom_wage_types: 0, total: 0 };
}

/**
 * 8. Wage Types per Country: group T512W by MOLGA, count distinct LGART,
 * map to T500T LTEXT filtered by SPRAS = 'E'.
 */
export async function getWageTypesPerCountry() {
  const { rows } = await query(
    `WITH countries AS (
       SELECT DISTINCT ON (molga) molga, ltext
       FROM pe_t500t
       WHERE spras = 'E' AND molga IS NOT NULL
       ORDER BY molga
     ),
     wt_counts AS (
       SELECT
         molga,
         COUNT(DISTINCT lgart)::int AS no_of_wage_types
       FROM pe_t512w
       WHERE molga IS NOT NULL AND molga <> ''
         AND lgart IS NOT NULL AND lgart <> ''
       GROUP BY molga
     )
     SELECT
       c.molga AS country_code,
       COALESCE(ct.ltext, 'NA') AS country_name,
       c.no_of_wage_types
     FROM wt_counts c
     LEFT JOIN countries ct ON ct.molga = c.molga
     ORDER BY c.molga;`
  );
  return rows;
}

/**
 * 9. Active Wage Types: distinct wage types from PA0008 (LGA01-40), PA0014, PA0015, PA0267
 * active within last 24 months, mapped to T512T LGTXT (SPRSL = 'E').
 */
export async function getActiveWageTypes() {
  const { rows } = await query(
    `WITH active_wts AS (
       SELECT unnest(ARRAY[
         lga01, lga02, lga03, lga04, lga05, lga06, lga07, lga08, lga09, lga10,
         lga11, lga12, lga13, lga14, lga15, lga16, lga17, lga18, lga19, lga20,
         lga21, lga22, lga23, lga24, lga25, lga26, lga27, lga28, lga29, lga30,
         lga31, lga32, lga33, lga34, lga35, lga36, lga37, lga38, lga39, lga40
       ]) AS lgart
       FROM pe_pa0008
       WHERE begda <= CURRENT_DATE AND endda >= (CURRENT_DATE - INTERVAL '24 months')
       UNION
       SELECT lgart
       FROM pe_pa0014
       WHERE begda <= CURRENT_DATE AND endda >= (CURRENT_DATE - INTERVAL '24 months')
       UNION
       SELECT lgart
       FROM pe_pa0015
       WHERE begda <= CURRENT_DATE AND endda >= (CURRENT_DATE - INTERVAL '24 months')
       UNION
       SELECT lgart
       FROM pe_pa0267
       WHERE begda <= CURRENT_DATE AND endda >= (CURRENT_DATE - INTERVAL '24 months')
     ),
     distinct_wts AS (
       SELECT DISTINCT lgart
       FROM active_wts
       WHERE lgart IS NOT NULL AND lgart <> ''
     ),
     texts AS (
       SELECT DISTINCT ON (lgart) lgart, lgtxt
       FROM pe_t512t
       WHERE sprsl = 'E' AND lgart IS NOT NULL
       ORDER BY lgart
     )
     SELECT
       w.lgart AS wage_type,
       COALESCE(t.lgtxt, 'NA') AS wage_type_text
     FROM distinct_wts w
     LEFT JOIN texts t ON t.lgart = w.lgart
     ORDER BY w.lgart;`
  );
  return rows;
}

/**
 * 10. Payroll Schema Summary: count distinct SCHEM from T52C0 (standard) and T52C1 (custom).
 */
export async function getPayrollSchemaSummary() {
  const { rows } = await query(
    `WITH std AS (
       SELECT COUNT(DISTINCT schem)::int AS std_count
       FROM pe_t52c0
       WHERE schem IS NOT NULL AND schem <> ''
     ),
     custom AS (
       SELECT COUNT(DISTINCT schem)::int AS custom_count
       FROM pe_t52c1
       WHERE schem IS NOT NULL AND schem <> ''
     )
     SELECT
       std.std_count AS std_payroll_schemas,
       custom.custom_count AS custom_payroll_schemas,
       (std.std_count + custom.custom_count)::int AS total
     FROM std, custom;`
  );
  return rows[0] ?? { std_payroll_schemas: 0, custom_payroll_schemas: 0, total: 0 };
}

/**
 * 11. Payroll Schema Subschemas: for each SCHEM where FUNCO = 'COPY', count distinct PARM1.
 * Returns separate result sets for standard (T52C0) and custom (T52C1).
 */
export async function getPayrollSchemaSubschemas() {
  const [stdResult, customResult] = await Promise.all([
    query(
      `SELECT
         schem,
         COUNT(DISTINCT parm1)::int AS no_of_subschemas
       FROM pe_t52c0
       WHERE funco = 'COPY'
         AND schem IS NOT NULL AND schem <> ''
         AND parm1 IS NOT NULL AND parm1 <> ''
       GROUP BY schem
       ORDER BY schem;`
    ),
    query(
      `SELECT
         schem,
         COUNT(DISTINCT parm1)::int AS no_of_subschemas
       FROM pe_t52c1
       WHERE funco = 'COPY'
         AND schem IS NOT NULL AND schem <> ''
         AND parm1 IS NOT NULL AND parm1 <> ''
       GROUP BY schem
       ORDER BY schem;`
    ),
  ]);
  return { std: stdResult.rows, custom: customResult.rows };
}

/**
 * 12. PCR Summary: count standard vs custom Personnel Calculation Rules from T52C5.
 * Custom = CCYCL starts with Z, Y, or 9.
 */
export async function getPcrSummary() {
  const { rows } = await query(
    `SELECT
       COUNT(*) FILTER (
         WHERE NOT (
           upper(ccycl) LIKE 'Z%' OR upper(ccycl) LIKE 'Y%' OR ccycl LIKE '9%'
         )
       )::int AS std_pcr,
       COUNT(*) FILTER (
         WHERE upper(ccycl) LIKE 'Z%' OR upper(ccycl) LIKE 'Y%' OR ccycl LIKE '9%'
       )::int AS custom_pcr,
       COUNT(*)::int AS total
     FROM (
       SELECT DISTINCT ccycl
       FROM pe_t52c5
       WHERE ccycl IS NOT NULL AND ccycl <> ''
     ) t;`
  );
  return rows[0] ?? { std_pcr: 0, custom_pcr: 0, total: 0 };
}

/**
 * 13. Payroll Functions and Operations Summary: from T52A0_T, classify by OTYPE.
 * Custom = ONAME starts with Y or Z (case-insensitive).
 */
export async function getPayrollFunctionsOperationsSummary() {
  const { rows } = await query(
    `SELECT
       otype,
       COUNT(*) FILTER (
         WHERE NOT (upper(oname) LIKE 'Z%' OR upper(oname) LIKE 'Y%')
       )::int AS std_count,
       COUNT(*) FILTER (
         WHERE upper(oname) LIKE 'Z%' OR upper(oname) LIKE 'Y%'
       )::int AS custom_count,
       COUNT(*)::int AS total
     FROM pe_t52a0_t
     WHERE otype IN ('FU', 'OP')
       AND oname IS NOT NULL AND oname <> ''
     GROUP BY otype;`
  );
  return rows;
}

/**
 * 14. Custom Functions and Operations: from T52A0_T, return ONAME starting with Z or Y.
 */
export async function getCustomFunctionsOperations() {
  const { rows } = await query(
    `SELECT otype, oname, lgtxt
     FROM pe_t52a0_t
     WHERE (upper(oname) LIKE 'Z%' OR upper(oname) LIKE 'Y%')
       AND oname IS NOT NULL AND oname <> ''
     ORDER BY otype, oname;`
  );
  return rows;
}

/**
 * 15. Unused Payroll Areas: payroll areas from T549A that have NOT appeared in HRPY_RGDIR
 * within the last 24 months (fpend >= today - 24 months), mapped to descriptions in T549T.
 */
export async function getUnusedPayrollAreas() {
  const { rows } = await query(
    `WITH active AS (
       SELECT DISTINCT abkrs
       FROM pe_hrpy_rgdir
       WHERE fpend >= (CURRENT_DATE - INTERVAL '24 months')
         AND abkrs IS NOT NULL AND abkrs <> ''
     ),
     unused AS (
       SELECT DISTINCT t.abkrs
       FROM pe_t549a t
       WHERE t.abkrs IS NOT NULL AND t.abkrs <> ''
         AND t.abkrs NOT IN (SELECT abkrs FROM active)
     ),
     texts AS (
       SELECT DISTINCT ON (abkrs) abkrs, atext
       FROM pe_t549t
       WHERE abkrs IS NOT NULL AND abkrs <> ''
       ORDER BY abkrs
     )
     SELECT
       u.abkrs,
       COALESCE(txt.atext, 'NA') AS atext
     FROM unused u
     LEFT JOIN texts txt ON txt.abkrs = u.abkrs
     ORDER BY u.abkrs;`
  );
  return rows;
}

