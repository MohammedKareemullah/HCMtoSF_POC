import { query } from "../../config/db.js";

// All filtering / joining / dedup / aggregation happens here, in SQL, on the staging tables.

/**
 * KPI 1: count of distinct infotypes per category.
 * Deduplicates INFTY from T777D, then returns every distinct infty with the numeric value
 * so the processor can categorise it in Node (category logic lives in constants, not SQL).
 */
export async function getDistinctInfotypes() {
  const { rows } = await query(
    `SELECT DISTINCT infty FROM hcm_t777d WHERE infty IS NOT NULL ORDER BY infty`
  );
  return rows; // [{ infty: '0001' }, ...]
}

/**
 * KPI 2: number of subtypes under each infotype.
 * Deduplicates (INFTY, SUBTY) pairs from T591A, then counts per INFTY.
 * NULL SUBTY values are excluded (a row with no subtype is not a subtype).
 */
export async function getSubtypeCountsPerInfotype() {
  const { rows } = await query(
    `SELECT infty, COUNT(DISTINCT subty)::int AS subtype_count
       FROM hcm_t591a
      WHERE infty IS NOT NULL AND subty IS NOT NULL
      GROUP BY infty
      ORDER BY infty`
  );
  return rows; // [{ infty: '0001', subtype_count: 3 }, ...]
}

/**
 * KPI 3: table of infotypes, no. of subtypes, category, and English (E) infotype text from T582S.
 * - Base is T777D (all distinct infotypes, deduplicated; no duplicates).
 * - T591A is joined to count distinct subtypes per infotype (0 if none match).
 * - T582S is joined on infty with sprsl = 'E' for the text ('NA' if none match).
 */
export async function getInfotypeSubtypeTable() {
  const { rows } = await query(
    `WITH distinct_inftys AS (
       SELECT DISTINCT infty
         FROM hcm_t777d
        WHERE infty IS NOT NULL
     ),
     subtypes AS (
       SELECT infty, COUNT(DISTINCT subty)::int AS subtype_count
         FROM hcm_t591a
        WHERE infty IS NOT NULL AND subty IS NOT NULL
        GROUP BY infty
     ),
     texts AS (
       SELECT DISTINCT ON (infty) infty, itext
         FROM hcm_t582s
        WHERE sprsl = 'E' AND infty IS NOT NULL
        ORDER BY infty, itext
     )
     SELECT d.infty,
            COALESCE(s.subtype_count, 0)::int AS subtype_count,
            COALESCE(t.itext, 'NA') AS itext
       FROM distinct_inftys d
       LEFT JOIN subtypes s ON s.infty = d.infty
       LEFT JOIN texts t ON t.infty = d.infty
      ORDER BY d.infty`
  );
  return rows; // [{ infty, subtype_count, itext }, ...]
}

/**
 * Also fetch distinct infotypes from T777D with their E text, used to build
 * the infotype-level description in the detail table when a subtype is null.
 */
export async function getInfotypeTexts() {
  const { rows } = await query(
    `SELECT DISTINCT ON (infty) infty, itext
       FROM hcm_t582s
      WHERE sprsl = 'E' AND infty IS NOT NULL
      ORDER BY infty, itext`
  );
  return rows; // [{ infty, itext }, ...]
}

