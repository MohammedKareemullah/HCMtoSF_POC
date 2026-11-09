import { countryName } from "../../shared/utils/countryName.js";
import { STAT2_LABELS, STAT2_ORDER } from "./headcount.constants.js";

// Pure functions: rows in, frontend-ready shapes out. No I/O, easy to unit test.

export { countryName };

export function statusLabel(code) {
  if (code === null || code === undefined) return "Unknown";
  return STAT2_LABELS[code] ?? `Unknown (${code})`;
}

const sum = (items) => items.reduce((n, i) => n + i.employees, 0);

/** Employees per STAT2 status. All four known statuses are always present (0 if none). */
export function buildStatusSummary(rows) {
  const byCode = new Map(rows.map((r) => [r.code, r.employees]));
  const items = STAT2_ORDER.map((code) => ({
    code,
    label: STAT2_LABELS[code],
    employees: byCode.get(code) ?? 0,
  }));
  // Any code outside 0-3 (or missing) is surfaced rather than silently dropped.
  for (const r of rows) {
    if (!STAT2_ORDER.includes(r.code)) items.push({ code: r.code, label: statusLabel(r.code), employees: r.employees });
  }
  return { total: sum(items), items };
}

export function buildCountrySummary(rows) {
  const items = rows
    .map((r) => ({ countryCode: r.code, country: countryName(r.code), employees: r.employees }))
    .sort((a, b) => b.employees - a.employees || a.country.localeCompare(b.country));
  return { total: sum(items), items };
}

export function buildCompanySummary(rows) {
  const items = rows
    .map((r) => ({
      companyCode: r.code,
      companyName: r.name ?? null,
      label: r.code ? (r.name ? `${r.code} - ${r.name}` : r.code) : "Unknown",
      employees: r.employees,
    }))
    .sort((a, b) => b.employees - a.employees || String(a.companyCode).localeCompare(String(b.companyCode)));
  return { total: sum(items), items };
}

export function buildEmployee(r) {
  return {
    pernr: r.pernr,
    statusCode: r.stat2,
    status: statusLabel(r.stat2),
    countryCode: r.land1,
    country: countryName(r.land1),
    companyCode: r.bukrs,
    companyName: r.butxt,
    personnelArea: r.werks,
    employeeGroup: r.persg,
    employeeSubgroup: r.persk,
    payrollArea: r.abkrs,
  };
}

export function buildEmployeePage({ rows, total }, { page, pageSize }) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    items: rows.map(buildEmployee),
  };
}

/** FPPER like '202403' -> { period, year, month, label: '2024-03' }. Other formats are passed through as-is. */
export function buildPayrollMonths(rows) {
  const items = rows.map((r) => {
    const m = /^(\d{4})(\d{2})$/.exec(r.period);
    return m
      ? { period: r.period, year: Number(m[1]), month: Number(m[2]), label: `${m[1]}-${m[2]}`, employees: r.employees }
      : { period: r.period, year: null, month: null, label: r.period, employees: r.employees };
  });
  return { items };
}

export function buildHires(yearRows, yearCountryRows) {
  const byYear = yearRows.map((r) => ({ year: r.year, hires: r.hires }));
  const byCountry = yearCountryRows
    .map((r) => ({ year: r.year, countryCode: r.code, country: countryName(r.code), hires: r.hires }))
    .sort((a, b) => a.year - b.year || b.hires - a.hires || a.country.localeCompare(b.country));
  return { total: byYear.reduce((n, r) => n + r.hires, 0), byYear, byCountry };
}
