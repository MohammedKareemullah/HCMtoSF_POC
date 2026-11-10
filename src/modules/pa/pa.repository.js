import { query } from "../../config/db.js";

/**
 * 1. Screen classifications: fetch all infotypes with their single screen (EDYNR)
 * and list screen (LDYNR) numbers from T582A.
 */
export async function getScreenClassifications() {
  const { rows } = await query(
    `SELECT infty, edynr, ldynr
     FROM pa_t582a
     WHERE infty IS NOT NULL
     ORDER BY infty;`
  );
  return rows;
}

/**
 * 2. Module pool mapping: take T588M entries where DYNNR and ADYNR are different
 * (excluding entries with blank DYNNR or ADYNR, without deduplicating REPNA).
 * Map to T777D (T588M.REPNA = T777D.REPID) to retrieve INFTY and module pool.
 */
export async function getModulePoolMapping() {
  const { rows } = await query(
    `WITH t777 AS (
       SELECT DISTINCT repid, infty
       FROM pa_t777d
       WHERE repid IS NOT NULL AND repid <> ''
     )
     SELECT t.infty, m.repna AS module_pool
     FROM pa_t588m m
     INNER JOIN t777 t ON t.repid = m.repna
     WHERE m.dynnr IS NOT NULL
       AND m.adynr IS NOT NULL
       AND m.dynnr <> ''
       AND m.adynr <> ''
       AND m.dynnr <> m.adynr
     ORDER BY t.infty, m.repna;`
  );
  return rows;
}

/**
 * 3. Field visibility summary: count DBILD symbols (-, *, +, .) for all T588M records
 * grouped by infotype via T777D mapping. Module pools not in T777D are ignored.
 */
export async function getFieldVisibilitySummary() {
  const { rows } = await query(
    `WITH t777 AS (
       SELECT DISTINCT repid, infty
       FROM pa_t777d
       WHERE repid IS NOT NULL AND repid <> ''
     ),
     mapped AS (
       SELECT t.infty, m.dbild
       FROM pa_t588m m
       INNER JOIN t777 t ON t.repid = m.repna
       WHERE m.dbild IS NOT NULL AND m.dbild <> ''
     )
     SELECT
       infty,
       SUM(length(dbild) - length(replace(dbild, '-', '')))::int AS hidden,
       SUM(length(dbild) - length(replace(dbild, '*', '')))::int AS display_only,
       SUM(length(dbild) - length(replace(dbild, '+', '')))::int AS required,
       SUM(length(dbild) - length(replace(dbild, '.', '')))::int AS optional
     FROM mapped
     GROUP BY infty
     ORDER BY infty;`
  );
  return rows;
}

/**
 * 4. Dynamic action count: distinct (INFTY, SUBTY, FNAME, OPERA, SEQNO) for dynamicActionSeqCount,
 * and distinct (INFTY, SUBTY, FNAME, OPERA) without SEQNO for dynamicCount, grouped by INFTY.
 */
export async function getDynamicActionCount() {
  const { rows } = await query(
    `WITH seq_distinct AS (
       SELECT DISTINCT infty, subty, fname, opera, seqno
       FROM pa_t588z
       WHERE infty IS NOT NULL
     ),
     block_distinct AS (
       SELECT DISTINCT infty, subty, fname, opera
       FROM pa_t588z
       WHERE infty IS NOT NULL
     ),
     seq_counts AS (
       SELECT infty, COUNT(*)::int AS dynamic_action_seq_count
       FROM seq_distinct
       GROUP BY infty
     ),
     block_counts AS (
       SELECT infty, COUNT(*)::int AS dynamic_count
       FROM block_distinct
       GROUP BY infty
     )
     SELECT
       s.infty,
       s.dynamic_action_seq_count,
       COALESCE(b.dynamic_count, 0)::int AS dynamic_count
     FROM seq_counts s
     LEFT JOIN block_counts b ON b.infty = s.infty
     ORDER BY s.infty;`
  );
  return rows;
}

/**
 * 5. Dynamic action triggers: filter for KENNZ = 'I', extracting source INFTY
 * and the list of unique target infotypes it affects parsed from VINFO command strings.
 */
export async function getDynamicActionTriggers() {
  const { rows } = await query(
    `WITH targets AS (
       SELECT DISTINCT
         infty AS source_infotype,
         (regexp_match(vinfo, '(?:INS|COP|MOD)[,( ]*(\\d{4})', 'i'))[1] AS target_infotype
       FROM pa_t588z
       WHERE upper(kennz) = 'I'
         AND (regexp_match(vinfo, '(?:INS|COP|MOD)[,( ]*(\\d{4})', 'i'))[1] IS NOT NULL
     )
     SELECT
       source_infotype,
       array_agg(target_infotype ORDER BY target_infotype) AS target_infotypes
     FROM targets
     GROUP BY source_infotype
     ORDER BY source_infotype;`
  );
  return rows;
}

/**
 * 6. Dynamic actions by operation: distinct logic blocks (INFTY, SUBTY, FNAME, OPERA)
 * for dynamicActionCount, and distinct (INFTY, SUBTY, FNAME, OPERA, SEQNO) for
 * dynamicActionSeqCount, grouped by OPERA code.
 */
export async function getDynamicActionByOperation() {
  const { rows } = await query(
    `WITH blocks AS (
       SELECT DISTINCT infty, subty, fname, opera
       FROM pa_t588z
       WHERE opera IS NOT NULL
     ),
     seq_blocks AS (
       SELECT DISTINCT infty, subty, fname, opera, seqno
       FROM pa_t588z
       WHERE opera IS NOT NULL
     ),
     b_count AS (
       SELECT opera, COUNT(*)::int AS dynamic_action_count
       FROM blocks
       GROUP BY opera
     ),
     s_count AS (
       SELECT opera, COUNT(*)::int AS dynamic_action_seq_count
       FROM seq_blocks
       GROUP BY opera
     )
     SELECT
       b.opera,
       b.dynamic_action_count,
       COALESCE(s.dynamic_action_seq_count, 0)::int AS dynamic_action_seq_count
     FROM b_count b
     LEFT JOIN s_count s ON s.opera = b.opera
     ORDER BY b.opera;`
  );
  return rows;
}

/**
 * 7. Dynamic action routines: filter KENNZ = 'F' (or 'f'), extract routine name inside
 * parentheses of VINFO, grouped by INFTY with COUNT(DISTINCT routine) and COUNT(*).
 */
export async function getDynamicActionRoutines() {
  const { rows } = await query(
    `WITH f_records AS (
       SELECT
         infty,
         (regexp_match(vinfo, '\\(([^)]+)\\)'))[1] AS routine_name
       FROM pa_t588z
       WHERE upper(kennz) = 'F' AND vinfo IS NOT NULL
     ),
     valid_routines AS (
       SELECT infty, routine_name
       FROM f_records
       WHERE routine_name IS NOT NULL AND routine_name <> ''
     )
     SELECT
       infty,
       COUNT(DISTINCT routine_name)::int AS unique_routine_count,
       string_agg(DISTINCT routine_name, ', ' ORDER BY routine_name) AS routine_names,
       COUNT(*)::int AS total_executions
     FROM valid_routines
     GROUP BY infty
     ORDER BY infty;`
  );
  return rows;
}

