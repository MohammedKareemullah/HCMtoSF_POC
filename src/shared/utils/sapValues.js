/** Trim an SAP value; empty string becomes null. */
export function cleanText(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/**
 * SAP date 'YYYYMMDD' -> 'YYYY-MM-DD'.
 * '00000000', blanks and impossible dates -> null. '99991231' is kept (open-ended record).
 */
export function sapDate(value) {
  const s = cleanText(value);
  if (!s || !/^\d{8}$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  if (y < 1 || m < 1 || m > 12 || d < 1) return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  probe.setUTCFullYear(y); // years 0-99 are mapped to 1900+ by the constructor
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

const CONVERTERS = {
  text: cleanText,
  date: sapDate,
};

export function convertValue(type, value) {
  const fn = CONVERTERS[type];
  if (!fn) throw new Error(`Unknown column type "${type}"`);
  return fn(value);
}
