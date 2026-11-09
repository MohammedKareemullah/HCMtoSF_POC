import { categoriseInfotype, INFOTYPE_CATEGORIES } from "./hcm_core.constants.js";

// Pure functions: rows in, frontend-ready shapes out.  No I/O, easy to unit test.

/**
 * KPI 1: group distinct infotypes by their functional category and count them.
 * Categories are always present in the response (0 count if none in that range).
 * Infotypes outside any defined range surface under "Unknown".
 */
export function buildInfotypeCategorySummary(rows) {
  // Count infotypes per category.
  const counts = new Map(INFOTYPE_CATEGORIES.map((c) => [c.label, 0]));
  let unknownCount = 0;

  for (const { infty } of rows) {
    const label = categoriseInfotype(infty);
    if (counts.has(label)) {
      counts.set(label, counts.get(label) + 1);
    } else {
      unknownCount++;
    }
  }

  const items = INFOTYPE_CATEGORIES.map((c) => ({
    category: c.label,
    range: `${String(c.min).padStart(4, "0")}–${String(c.max).padStart(4, "0")}`,
    infotypeCount: counts.get(c.label),
  }));

  if (unknownCount > 0) {
    items.push({ category: "Unknown", range: null, infotypeCount: unknownCount });
  }

  return {
    total: rows.length,
    items,
  };
}

/**
 * KPI 2: number of subtypes per infotype.
 * Also attaches the category for each infotype so the consumer can filter/group if needed.
 */
export function buildSubtypeCountsPerInfotype(rows) {
  const items = rows.map((r) => ({
    infotype: r.infty,
    category: categoriseInfotype(r.infty),
    subtypeCount: r.subtype_count,
  }));
  return {
    total: items.length,
    totalSubtypes: items.reduce((n, r) => n + r.subtypeCount, 0),
    items,
  };
}

/**
 * KPI 3: table of infotypes, no. of subtypes, category, and infotype text.
 */
export function buildInfotypeSubtypeTable(rows) {
  const items = rows.map((r) => ({
    infotype: r.infty,
    noOfSubtypes: r.subtype_count ?? 0,
    category: categoriseInfotype(r.infty),
    infotypeText: r.itext && r.itext !== "null" ? r.itext : "NA",
  }));
  return { total: items.length, items };
}

