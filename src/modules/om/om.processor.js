// Pure functions: rows/data in, frontend-ready shapes out. No I/O, easy to test.

/**
 * 1. OM Object Types: standard vs custom summary.
 */
export function buildObjectTypesSummary(input) {
  if (Array.isArray(input)) {
    const valid = input.map((r) => r.otype).filter(Boolean);
    const unique = [...new Set(valid)];
    const custom = unique.filter((o) => o.startsWith("9")).length;
    const std = unique.length - custom;
    return { stdOmObjects: std, customOmObjects: custom, total: unique.length };
  }
  return {
    stdOmObjects: input?.std_om_objects ?? 0,
    customOmObjects: input?.custom_om_objects ?? 0,
    total: input?.total ?? 0,
  };
}

/**
 * 2. OM Relationships: standard vs custom summary.
 * Custom = starts with 'Z' (case-insensitive) OR numeric between 900-999.
 */
export function buildRelationshipsSummary(input) {
  if (Array.isArray(input)) {
    const valid = input.map((r) => r.relat).filter(Boolean);
    const unique = [...new Set(valid)];
    const isCustom = (r) => {
      const up = r.toUpperCase();
      if (up.startsWith("Z")) return true;
      const n = parseInt(r, 10);
      return !isNaN(n) && String(n) === r && n >= 900 && n <= 999;
    };
    const custom = unique.filter(isCustom).length;
    const std = unique.length - custom;
    return { stdOmRelationships: std, customOmRelationships: custom, total: unique.length };
  }
  return {
    stdOmRelationships: input?.std_om_relationships ?? 0,
    customOmRelationships: input?.custom_om_relationships ?? 0,
    total: input?.total ?? 0,
  };
}

/**
 * 3. OM Evaluation Paths: standard vs custom summary.
 * Custom = starts with 'Z' (case-insensitive).
 */
export function buildEvaluationPathsSummary(input) {
  if (Array.isArray(input)) {
    const valid = input.map((r) => r.wegid).filter(Boolean);
    const unique = [...new Set(valid)];
    const custom = unique.filter((w) => w.toUpperCase().startsWith("Z")).length;
    const std = unique.length - custom;
    return { stdOmEvaluationPaths: std, customOmEvaluationPaths: custom, total: unique.length };
  }
  return {
    stdOmEvaluationPaths: input?.std_om_evaluation_paths ?? 0,
    customOmEvaluationPaths: input?.custom_om_evaluation_paths ?? 0,
    total: input?.total ?? 0,
  };
}

/**
 * 4. Objects per Plan Version.
 */
export function buildObjectsPerPlanVersion(rows) {
  const items = (rows ?? []).map((r) => ({
    plvar: r.plvar,
    ptext: r.ptext ?? "NA",
    noOfObjects: r.no_of_objects ?? r.objectCount ?? 0,
  }));
  return {
    total: items.length,
    items,
  };
}

/**
 * 5. Relationships per Plan Version.
 */
export function buildRelationshipsPerPlanVersion(rows) {
  const items = (rows ?? []).map((r) => ({
    plvar: r.plvar,
    ptext: r.ptext ?? "NA",
    noOfRelationships: r.no_of_relationships ?? r.relationshipCount ?? 0,
  }));
  return {
    total: items.length,
    items,
  };
}

/**
 * 6. Authorization Profiles: assigned vs unassigned.
 */
export function buildAuthProfilesSummary(input) {
  if (input && Array.isArray(input.t77pq) && Array.isArray(input.t77ua)) {
    const pq = [...new Set(input.t77pq.map((r) => r.profl).filter(Boolean))];
    const ua = new Set(input.t77ua.map((r) => r.profl).filter(Boolean));
    const assigned = pq.filter((p) => ua.has(p)).length;
    const unassigned = pq.length - assigned;
    return { assignedAuthProfiles: assigned, unassignedAuthProfiles: unassigned, total: pq.length };
  }
  return {
    assignedAuthProfiles: input?.assigned_auth_profiles ?? 0,
    unassignedAuthProfiles: input?.unassigned_auth_profiles ?? 0,
    total: input?.total ?? 0,
  };
}

