import { query } from "../../config/db.js";

// All filtering / joining / aggregation happens here, in SQL, on the staging tables.
// The view hc_employee_current (see migrations/001_init.sql) holds the per-employee join.

/** KPI 1a: employees per STAT2 status (distinct PERNR, latest PA0000 record). */
export async function getStatusCounts() {
  const { rows } = await query(
    `SELECT stat2 AS code, COUNT(*)::int AS employees
       FROM hc_employee_current
      GROUP BY stat2`
  );
  return rows;
}

/** KPI 1b: employees per country (PA0001-WERKS -> T500P-LAND1). */
export async function getCountryCounts() {
  const { rows } = await query(
    `SELECT land1 AS code, COUNT(*)::int AS employees
       FROM hc_employee_current
      GROUP BY land1`
  );
  return rows;
}

/** KPI 1c: employees per company code (PA0001-BUKRS -> T001-BUTXT). */
export async function getCompanyCodeCounts() {
  const { rows } = await query(
    `SELECT bukrs AS code, MIN(butxt) AS name, COUNT(*)::int AS employees
       FROM hc_employee_current
      GROUP BY bukrs`
  );
  return rows;
}

/**
 * KPI 1d: the employee table (filterable + paginated).
 * country / companyCode accept the literal 'UNKNOWN' to find employees with no mapping.
 */
export async function getEmployees({ status, country, companyCode, search, limit, offset }) {
  const { rows } = await query(
    `SELECT pernr, stat2, bukrs, butxt, werks, land1, persg, persk, abkrs,
            COUNT(*) OVER()::int AS total_count
       FROM hc_employee_current
      WHERE ($1::text IS NULL OR stat2 = $1)
        AND ($2::text IS NULL OR ($2 = 'UNKNOWN' AND land1 IS NULL) OR land1 = $2)
        AND ($3::text IS NULL OR ($3 = 'UNKNOWN' AND bukrs IS NULL) OR bukrs = $3)
        AND ($4::text IS NULL OR pernr ILIKE $4 || '%')
      ORDER BY pernr
      LIMIT $5 OFFSET $6`,
    [status ?? null, country ?? null, companyCode ?? null, search ?? null, limit, offset]
  );
  return { rows, total: rows[0]?.total_count ?? 0 };
}

/** KPI 2: distinct employees with a payroll result, per period (FPPER) actually present in the data. */
export async function getPayrollEmployeesByPeriod({ srtzaFilter = [] } = {}) {
  const { rows } = await query(
    `SELECT fpper AS period, COUNT(DISTINCT pernr)::int AS employees
       FROM hc_hrpy_rgdir
      WHERE fpper IS NOT NULL
        AND (cardinality($1::text[]) = 0 OR srtza = ANY($1::text[]))
      GROUP BY fpper
      ORDER BY fpper`,
    [srtzaFilter]
  );
  return rows;
}

/** KPI 3a: distinct employees hired per calendar year (PA0000 records with a hire MASSN, by BEGDA). */
export async function getHiresByYear({ massnCodes }) {
  const { rows } = await query(
    `SELECT EXTRACT(YEAR FROM begda)::int AS year, COUNT(DISTINCT pernr)::int AS hires
       FROM hc_pa0000
      WHERE massn = ANY($1::text[]) AND begda IS NOT NULL
      GROUP BY 1
      ORDER BY 1`,
    [massnCodes]
  );
  return rows;
}

/** KPI 3b: same hires, split by the employee's current country. */
export async function getHiresByYearAndCountry({ massnCodes }) {
  const { rows } = await query(
    `WITH hires AS (
       SELECT DISTINCT pernr, EXTRACT(YEAR FROM begda)::int AS year
         FROM hc_pa0000
        WHERE massn = ANY($1::text[]) AND begda IS NOT NULL
     )
     SELECT h.year, e.land1 AS code, COUNT(*)::int AS hires
       FROM hires h
       LEFT JOIN hc_employee_current e ON e.pernr = h.pernr
      GROUP BY h.year, e.land1
      ORDER BY h.year`,
    [massnCodes]
  );
  return rows;
}
