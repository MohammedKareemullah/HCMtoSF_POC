/**
 * TM processor — pure functions that shape repository output into API response data.
 * No I/O here; all inputs come from the repository layer.
 */

/**
 * EP1: Work schedule rules count.
 * @param {{count: number}} input
 */
export function buildWorkScheduleRules(input) {
  return { noOfWorkScheduleRules: input?.count ?? 0 };
}

/**
 * EP2: Daily work schedules count.
 * @param {{count: number}} input
 */
export function buildDailyWorkSchedules(input) {
  return { noOfDailyWorkSchedules: input?.count ?? 0 };
}

/**
 * EP3: Period work schedules count.
 * @param {{count: number}} input
 */
export function buildPeriodWorkSchedules(input) {
  return { noOfPeriodWorkSchedules: input?.count ?? 0 };
}

/**
 * EP4: Nest the flat (schkz, zmodn, tprogs[]) rows into:
 * { total, items: [{ schkz, periods: [{ zmodn, dailyWorkSchedules: [...] }] }] }
 * @param {Array<{schkz: string, zmodn: string, tprogs: string[]}>} rows
 */
export function buildWorkScheduleMapping(rows) {
  // Group by schkz → zmodn → tprogs
  const schkzMap = new Map();
  for (const row of rows) {
    if (!schkzMap.has(row.schkz)) {
      schkzMap.set(row.schkz, new Map());
    }
    const zmodMap = schkzMap.get(row.schkz);
    zmodMap.set(row.zmodn, (row.tprogs ?? []));
  }

  const items = [];
  for (const [schkz, zmodMap] of schkzMap) {
    const periods = [];
    for (const [zmodn, tprogs] of zmodMap) {
      periods.push({ zmodn, dailyWorkSchedules: tprogs });
    }
    items.push({ schkz, periods });
  }

  return { total: items.length, items };
}

/**
 * EP5: Break schedules — unique counts of tprog, zmodn, schkz and list of {tprog, zmodn, schkz}.
 * @param {Array<{tprog: string, zmodn: string, schkz: string}>} rows
 */
export function buildBreakSchedules(rows) {
  return buildSchedulesWithUniqueCounts(rows);
}

/** Shared helper for endpoints returning (tprog, zmodn, schkz) rows plus unique counts. */
function buildSchedulesWithUniqueCounts(rows) {
  const uniqueTprog = new Set();
  const uniqueZmodn = new Set();
  const uniqueSchkz = new Set();

  const items = rows.map((r) => {
    if (r.tprog) uniqueTprog.add(r.tprog);
    if (r.zmodn) uniqueZmodn.add(r.zmodn);
    if (r.schkz) uniqueSchkz.add(r.schkz);
    return { tprog: r.tprog, zmodn: r.zmodn, schkz: r.schkz };
  });

  return {
    total: items.length,
    noOfTprog: uniqueTprog.size,
    noOfZmodn: uniqueZmodn.size,
    noOfSchkz: uniqueSchkz.size,
    items,
  };
}

/**
 * EP6: Overtime schedules — unique counts of tprog, zmodn, schkz and list of {tprog, zmodn, schkz}.
 * @param {Array<{tprog: string, zmodn: string, schkz: string}>} rows
 */
export function buildOvertimeSchedules(rows) {
  return buildSchedulesWithUniqueCounts(rows);
}

/**
 * EP7: Modifier-linked schedules — unique counts of tprog, zmodn, schkz and list of {tprog, zmodn, schkz}.
 * @param {Array<{tprog: string, zmodn: string, schkz: string}>} rows
 */
export function buildModifierSchedules(rows) {
  return buildSchedulesWithUniqueCounts(rows);
}

/**
 * EP8: Attendance and absence type counts, split by standard vs. custom.
 * @param {{std_absence_types: number, custom_absence_types: number, std_attendance_types: number, custom_attendance_types: number}} input
 */
export function buildAttendanceAbsenceTypes(input) {
  return {
    absences: {
      stdAbsenceTypes: input?.std_absence_types ?? 0,
      customAbsenceTypes: input?.custom_absence_types ?? 0,
    },
    attendances: {
      stdAttendanceTypes: input?.std_attendance_types ?? 0,
      customAttendanceTypes: input?.custom_attendance_types ?? 0,
    },
  };
}

/** Shared formatter for unused absence/attendance subtypes with T554T descriptions. */
function buildUnusedSubtypes(rows) {
  return {
    total: rows.length,
    items: rows.map((r) => ({
      subtype: r.subty,
      description: r.atext ?? "NA",
    })),
  };
}

/**
 * EP9: Unused absence subtypes with descriptions.
 * @param {Array<{subty: string, atext?: string}>} rows
 */
export function buildUnusedAbsenceTypes(rows) {
  return buildUnusedSubtypes(rows);
}

/**
 * EP10: Unused attendance subtypes with descriptions.
 * @param {Array<{subty: string, atext?: string}>} rows
 */
export function buildUnusedAttendanceTypes(rows) {
  return buildUnusedSubtypes(rows);
}

