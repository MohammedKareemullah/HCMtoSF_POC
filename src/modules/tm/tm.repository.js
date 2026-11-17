import { query } from "../../config/db.js";

/**
 * EP1: Count distinct work schedule rules (SCHKZ) from T508A.
 * @returns {Promise<{count: number}>}
 */
export async function getWorkScheduleRules() {
  const { rows } = await query(
    `SELECT COUNT(DISTINCT schkz)::int AS count
     FROM tm_t508a
     WHERE schkz IS NOT NULL AND schkz <> ''`,
  );
  return rows[0];
}

/**
 * EP2: Count distinct daily work schedules (TPROG) from T550A.
 * @returns {Promise<{count: number}>}
 */
export async function getDailyWorkSchedules() {
  const { rows } = await query(
    `SELECT COUNT(DISTINCT tprog)::int AS count
     FROM tm_t550a
     WHERE tprog IS NOT NULL AND tprog <> ''`,
  );
  return rows[0];
}

/**
 * EP3: Count distinct period work schedules (ZMODN) from T551A.
 * @returns {Promise<{count: number}>}
 */
export async function getPeriodWorkSchedules() {
  const { rows } = await query(
    `SELECT COUNT(DISTINCT zmodn)::int AS count
     FROM tm_t551a
     WHERE zmodn IS NOT NULL AND zmodn <> ''`,
  );
  return rows[0];
}

/**
 * EP4: Build the work-schedule mapping.
 * Returns flat rows of (schkz, zmodn, tprogs[]) so the processor can nest them.
 * T551A maps ZMODN -> TPRG1..TPRG7; T508A maps SCHKZ -> ZMODN.
 * @returns {Promise<Array<{schkz: string, zmodn: string, tprogs: string[]}>>}
 */
export async function getWorkScheduleMapping() {
  const { rows } = await query(`
    WITH tprogs AS (
      SELECT DISTINCT zmodn,
        unnest(ARRAY[tprg1,tprg2,tprg3,tprg4,tprg5,tprg6,tprg7]) AS tprog
      FROM tm_t551a
      WHERE zmodn IS NOT NULL AND zmodn <> ''
    ),
    valid_tprogs AS (
      SELECT zmodn, tprog FROM tprogs WHERE tprog IS NOT NULL AND tprog <> ''
    ),
    zmodn_tprogs AS (
      SELECT zmodn, array_agg(DISTINCT tprog ORDER BY tprog) AS tprogs
      FROM valid_tprogs GROUP BY zmodn
    ),
    schkz_zmodn AS (
      SELECT DISTINCT schkz, zmodn FROM tm_t508a
      WHERE schkz IS NOT NULL AND schkz <> ''
        AND zmodn IS NOT NULL AND zmodn <> ''
    )
    SELECT s.schkz, s.zmodn, COALESCE(zt.tprogs, '{}') AS tprogs
    FROM schkz_zmodn s
    LEFT JOIN zmodn_tprogs zt ON zt.zmodn = s.zmodn
    ORDER BY s.schkz, s.zmodn
  `);
  return rows;
}

/**
 * EP5: Daily work schedules that have break time defined (BTBEG/BTEND/ETBEG/ETEND non-empty),
 * resolved through the TPROG → ZMODN → SCHKZ chain.
 * @returns {Promise<Array<{tprog: string, zmodn: string, schkz: string}>>}
 */
export async function getBreakSchedules() {
  const { rows } = await query(`
    WITH filtered AS (
      SELECT DISTINCT tprog FROM tm_t550a
      WHERE tprog IS NOT NULL AND tprog <> ''
        AND (
          (btbeg IS NOT NULL AND btbeg <> '') OR
          (btend IS NOT NULL AND btend <> '') OR
          (etbeg IS NOT NULL AND etbeg <> '') OR
          (etend IS NOT NULL AND etend <> '')
        )
    ),
    tprog_zmodn AS (
      SELECT DISTINCT f.tprog, s.zmodn
      FROM filtered f
      JOIN (
        SELECT zmodn, unnest(ARRAY[tprg1,tprg2,tprg3,tprg4,tprg5,tprg6,tprg7]) AS tprog
        FROM tm_t551a
      ) s ON s.tprog = f.tprog
      WHERE s.zmodn IS NOT NULL AND s.zmodn <> ''
    ),
    tprog_schkz AS (
      SELECT tz.tprog, tz.zmodn, t5.schkz
      FROM tprog_zmodn tz
      JOIN tm_t508a t5 ON t5.zmodn = tz.zmodn
      WHERE t5.schkz IS NOT NULL AND t5.schkz <> ''
    )
    SELECT DISTINCT tprog, zmodn, schkz FROM tprog_schkz ORDER BY tprog, zmodn, schkz
  `);
  return rows;
}

/**
 * EP6: Daily work schedules that have overtime/special time defined (SOBEG/SOEND non-empty),
 * resolved through the TPROG → ZMODN → SCHKZ chain.
 * @returns {Promise<Array<{tprog: string, zmodn: string, schkz: string}>>}
 */
export async function getOvertimeSchedules() {
  const { rows } = await query(`
    WITH filtered AS (
      SELECT DISTINCT tprog FROM tm_t550a
      WHERE tprog IS NOT NULL AND tprog <> ''
        AND (
          (sobeg IS NOT NULL AND sobeg <> '') OR
          (soend IS NOT NULL AND soend <> '')
        )
    ),
    tprog_zmodn AS (
      SELECT DISTINCT f.tprog, s.zmodn
      FROM filtered f
      JOIN (
        SELECT zmodn, unnest(ARRAY[tprg1,tprg2,tprg3,tprg4,tprg5,tprg6,tprg7]) AS tprog
        FROM tm_t551a
      ) s ON s.tprog = f.tprog
      WHERE s.zmodn IS NOT NULL AND s.zmodn <> ''
    ),
    tprog_schkz AS (
      SELECT tz.tprog, tz.zmodn, t5.schkz
      FROM tprog_zmodn tz
      JOIN tm_t508a t5 ON t5.zmodn = tz.zmodn
      WHERE t5.schkz IS NOT NULL AND t5.schkz <> ''
    )
    SELECT DISTINCT tprog, zmodn, schkz FROM tprog_schkz ORDER BY tprog, zmodn, schkz
  `);
  return rows;
}

/**
 * EP7: Daily work schedules associated with work schedule modifiers (PAMOD from T550P),
 * joined via MOTPR to T550A, then resolved TPROG → ZMODN → SCHKZ.
 * @returns {Promise<Array<{tprog: string, zmodn: string, schkz: string}>>}
 */
export async function getModifierSchedules() {
  const { rows } = await query(`
    WITH pamod_tprog AS (
      SELECT DISTINCT p.pamod, a.tprog
      FROM tm_t550p p
      JOIN tm_t550a a ON a.motpr = p.motpr
      WHERE p.pamod IS NOT NULL AND p.pamod <> ''
        AND a.tprog IS NOT NULL AND a.tprog <> ''
    ),
    tprog_zmodn AS (
      SELECT DISTINCT pt.tprog, s.zmodn
      FROM pamod_tprog pt
      JOIN (
        SELECT zmodn, unnest(ARRAY[tprg1,tprg2,tprg3,tprg4,tprg5,tprg6,tprg7]) AS tprog
        FROM tm_t551a
      ) s ON s.tprog = pt.tprog
      WHERE s.zmodn IS NOT NULL AND s.zmodn <> ''
    ),
    result AS (
      SELECT tz.tprog, tz.zmodn, t5.schkz
      FROM tprog_zmodn tz
      JOIN tm_t508a t5 ON t5.zmodn = tz.zmodn
      WHERE t5.schkz IS NOT NULL AND t5.schkz <> ''
    )
    SELECT DISTINCT tprog, zmodn, schkz FROM result ORDER BY tprog, zmodn, schkz
  `);
  return rows;
}

/**
 * EP8: Count standard vs. custom attendance and absence subtypes from T554S.
 * Custom = SUBTY starts with Z, Y, or 9.
 * @returns {Promise<{std_absence_types: number, custom_absence_types: number, std_attendance_types: number, custom_attendance_types: number}>}
 */
export async function getAttendanceAbsenceTypes() {
  const { rows } = await query(`
    SELECT
      COUNT(*) FILTER (
        WHERE art01 = 'A'
          AND NOT (upper(subty) LIKE 'Z%' OR upper(subty) LIKE 'Y%' OR subty LIKE '9%')
      )::int AS std_absence_types,
      COUNT(*) FILTER (
        WHERE art01 = 'A'
          AND (upper(subty) LIKE 'Z%' OR upper(subty) LIKE 'Y%' OR subty LIKE '9%')
      )::int AS custom_absence_types,
      COUNT(*) FILTER (
        WHERE art01 = 'P'
          AND NOT (upper(subty) LIKE 'Z%' OR upper(subty) LIKE 'Y%' OR subty LIKE '9%')
      )::int AS std_attendance_types,
      COUNT(*) FILTER (
        WHERE art01 = 'P'
          AND (upper(subty) LIKE 'Z%' OR upper(subty) LIKE 'Y%' OR subty LIKE '9%')
      )::int AS custom_attendance_types
    FROM tm_t554s
    WHERE subty IS NOT NULL AND subty <> '' AND art01 IN ('A', 'P')
  `);
  return rows[0];
}

async function getUnusedSubtypes({ activeTable, art01 }) {
  const { rows } = await query(
    `WITH active AS (
       SELECT DISTINCT subty FROM ${activeTable}
       WHERE begda <= CURRENT_DATE
         AND endda >= (CURRENT_DATE - INTERVAL '24 months')
         AND subty IS NOT NULL AND subty <> ''
     ),
     unused_types AS (
       SELECT DISTINCT subty FROM tm_t554s
       WHERE art01 = $1 AND subty IS NOT NULL AND subty <> ''
         AND subty NOT IN (SELECT subty FROM active)
     ),
     texts AS (
       SELECT DISTINCT ON (awart) awart, atext
       FROM tm_t554t
       WHERE awart IS NOT NULL AND awart <> ''
       ORDER BY awart, atext
     )
     SELECT
       u.subty,
       COALESCE(t.atext, 'NA') AS atext
     FROM unused_types u
     LEFT JOIN texts t ON t.awart = u.subty
     ORDER BY u.subty`,
    [art01],
  );
  return rows;
}

/**
 * EP9: Unused absence types — T554S subtypes (ART01='A') not found in
 * active PA2001 records (BEGDA <= today AND ENDDA >= today - 24 months),
 * mapped to T554T-ATEXT via T554S-SUBTY = T554T-AWART.
 * @returns {Promise<Array<{subty: string, atext: string}>>}
 */
export function getUnusedAbsenceTypes() {
  return getUnusedSubtypes({ activeTable: "tm_pa2001", art01: "A" });
}

/**
 * EP10: Unused attendance types — T554S subtypes (ART01='P') not found in
 * active PA2002 records (BEGDA <= today AND ENDDA >= today - 24 months),
 * mapped to T554T-ATEXT via T554S-SUBTY = T554T-AWART.
 * @returns {Promise<Array<{subty: string, atext: string}>>}
 */
export function getUnusedAttendanceTypes() {
  return getUnusedSubtypes({ activeTable: "tm_pa2002", art01: "P" });
}

