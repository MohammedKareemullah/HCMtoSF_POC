import { COUNTRY_NAMES } from "../data/countryNames.js";

const icuRegionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  } catch {
    return null;
  }
})();

function icuName(code) {
  try {
    return icuRegionNames?.of(code);
  } catch {
    return undefined; // not a well-formed region code
  }
}

/**
 * Country code (LAND1) -> display name.
 *  1. the SAP country list (shared/data/countryNames.js)   e.g. US -> "USA"
 *  2. for codes missing from that list, the standard English name   e.g. CH -> "Switzerland"
 *  3. otherwise the code itself; an empty code is "Unknown"
 */
export function countryName(code) {
  const key = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!key) return "Unknown";
  return COUNTRY_NAMES[key] ?? icuName(key) ?? key;
}
