import {
  classifyScreen,
  EDYNR_CATEGORIES,
  LDYNR_CATEGORIES,
  OPERA_LABELS,
} from "./pa.constants.js";

// Pure functions: rows in, frontend-ready shapes out. No I/O, easy to test.

/**
 * 1a. Single screen (EDYNR) classification.
 */
export function buildSingleScreenClassification(rows) {
  const counts = new Map();
  const items = rows.map((r) => {
    const classification = classifyScreen(r.edynr, EDYNR_CATEGORIES);
    counts.set(classification, (counts.get(classification) ?? 0) + 1);
    return {
      infotype: r.infty,
      singleScreen: r.edynr,
      classification,
    };
  });

  const summary = [...counts.entries()].map(([classification, count]) => ({
    classification,
    count,
  }));

  return {
    total: items.length,
    summary,
    items,
  };
}

/**
 * 1b. List screen (LDYNR) classification.
 */
export function buildListScreenClassification(rows) {
  const counts = new Map();
  const items = rows.map((r) => {
    const classification = classifyScreen(r.ldynr, LDYNR_CATEGORIES);
    counts.set(classification, (counts.get(classification) ?? 0) + 1);
    return {
      infotype: r.infty,
      listScreen: r.ldynr,
      classification,
    };
  });

  const summary = [...counts.entries()].map(([classification, count]) => ({
    classification,
    count,
  }));

  return {
    total: items.length,
    summary,
    items,
  };
}

/**
 * 2. Module pool mapping (REPNA mapped to T777D INFTY where DYNNR != ADYNR).
 */
export function buildModulePoolMapping(rows) {
  const items = rows.map((r) => ({
    infotype: r.infty,
    modulePool: r.module_pool,
  }));
  return {
    total: items.length,
    items,
  };
}

/**
 * 3. Field visibility summary (DBILD symbol counts per infotype).
 */
export function buildFieldVisibilitySummary(rows) {
  const items = rows.map((r) => ({
    infotype: r.infty,
    hidden: r.hidden ?? 0,
    displayOnly: r.display_only ?? 0,
    required: r.required ?? 0,
    optional: r.optional ?? 0,
  }));
  return {
    total: items.length,
    items,
  };
}

/**
 * 4. Dynamic action count per infotype:
 * dynamicActionSeqCount groups (INFTY, SUBTY, FNAME, OPERA, SEQNO)
 * dynamicCount groups (INFTY, SUBTY, FNAME, OPERA) without SEQNO.
 */
export function buildDynamicActionCount(rows) {
  const items = rows.map((r) => ({
    infotype: r.infty,
    dynamicActionSeqCount: r.dynamic_action_seq_count,
    dynamicCount: r.dynamic_count,
  }));
  return {
    total: items.length,
    totalActions: items.reduce((sum, r) => sum + (r.dynamicActionSeqCount ?? 0), 0),
    items,
  };
}

/**
 * 5. Dynamic action triggers: unique source infotypes and their list of unique target infotypes.
 */
export function buildDynamicActionTriggers(rows) {
  const grouped = new Map();

  for (const r of rows) {
    const infty = r.source_infotype ?? r.infty;
    if (!infty) continue;

    if (!grouped.has(infty)) {
      grouped.set(infty, new Set());
    }

    if (Array.isArray(r.target_infotypes)) {
      for (const t of r.target_infotypes) {
        if (t) grouped.get(infty).add(t);
      }
    } else if (r.target_infotype) {
      grouped.get(infty).add(r.target_infotype);
    }
  }

  const items = [...grouped.entries()].map(([infotype, targets]) => ({
    infotype,
    targetInfotypes: [...targets].sort(),
  }));

  return {
    total: items.length,
    items,
  };
}

/**
 * 6. Dynamic actions grouped by OPERA operation code:
 * dynamicActionCount (grouped by INFTY, SUBTY, FNAME, OPERA)
 * dynamicActionSeqCount (grouped by INFTY, SUBTY, FNAME, OPERA, SEQNO).
 */
export function buildDynamicActionByOperation(rows) {
  const items = rows.map((r) => ({
    operation: r.opera,
    description: OPERA_LABELS[r.opera] ?? "Unknown",
    dynamicActionCount: r.dynamic_action_count,
    dynamicActionSeqCount: r.dynamic_action_seq_count,
  }));
  return {
    total: items.length,
    items,
  };
}

/**
 * 7. Dynamic action routines (KENNZ = 'F').
 */
export function buildDynamicActionRoutines(rows) {
  const items = rows.map((r) => ({
    infotype: r.infty,
    uniqueRoutineCount: r.unique_routine_count,
    routineNames: r.routine_names,
    uniqueRoutineNames: r.routine_names,
    totalDynamicActions: r.total_executions,
    totalExecutions: r.total_executions,
  }));
  return {
    total: items.length,
    items,
  };
}

