import { query } from "../../config/db.js";

/**
 * 1. OM Object Types: count standard (does not start with '9') vs custom (starts with '9')
 * from distinct non-null OTYPE in T778O.
 */
export async function getObjectTypesSummary() {
  const { rows } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE otype NOT LIKE '9%')::int AS std_om_objects,
       COUNT(*) FILTER (WHERE otype LIKE '9%')::int AS custom_om_objects,
       COUNT(*)::int AS total
     FROM (
       SELECT DISTINCT otype
       FROM om_t778o
       WHERE otype IS NOT NULL AND otype <> ''
     ) t;`
  );
  return rows[0] ?? { std_om_objects: 0, custom_om_objects: 0, total: 0 };
}

/**
 * 2. OM Relationships: count standard vs custom (starts with 'Z' or 900-999)
 * from distinct non-null RELAT in T778V.
 */
export async function getRelationshipsSummary() {
  const { rows } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE NOT (upper(relat) LIKE 'Z%' OR (relat ~ '^[0-9]+$' AND relat::int BETWEEN 900 AND 999)))::int AS std_om_relationships,
       COUNT(*) FILTER (WHERE upper(relat) LIKE 'Z%' OR (relat ~ '^[0-9]+$' AND relat::int BETWEEN 900 AND 999))::int AS custom_om_relationships,
       COUNT(*)::int AS total
     FROM (
       SELECT DISTINCT relat
       FROM om_t778v
       WHERE relat IS NOT NULL AND relat <> ''
     ) t;`
  );
  return rows[0] ?? { std_om_relationships: 0, custom_om_relationships: 0, total: 0 };
}

/**
 * 3. OM Evaluation Paths: count standard (does not start with 'Z') vs custom (starts with 'Z')
 * from distinct non-null WEGID in T778A.
 */
export async function getEvaluationPathsSummary() {
  const { rows } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE upper(wegid) NOT LIKE 'Z%')::int AS std_om_evaluation_paths,
       COUNT(*) FILTER (WHERE upper(wegid) LIKE 'Z%')::int AS custom_om_evaluation_paths,
       COUNT(*)::int AS total
     FROM (
       SELECT DISTINCT wegid
       FROM om_t778a
       WHERE wegid IS NOT NULL AND wegid <> ''
     ) t;`
  );
  return rows[0] ?? { std_om_evaluation_paths: 0, custom_om_evaluation_paths: 0, total: 0 };
}

/**
 * 4. Objects per Plan Version: count HRP1000 OTYPE grouped by PLVAR,
 * mapped to T777P PTEXT filtered by SPRAS = 'E'.
 */
export async function getObjectsPerPlanVersion() {
  const { rows } = await query(
    `WITH ptexts AS (
       SELECT DISTINCT ON (plvar) plvar, ptext
       FROM om_t777p
       WHERE spras = 'E' AND plvar IS NOT NULL
       ORDER BY plvar
     ),
     obj_counts AS (
       SELECT plvar, COUNT(*)::int AS object_count
       FROM om_hrp1000
       WHERE plvar IS NOT NULL AND otype IS NOT NULL AND otype <> ''
       GROUP BY plvar
     )
     SELECT
       o.plvar,
       COALESCE(p.ptext, 'NA') AS ptext,
       o.object_count AS no_of_objects
     FROM obj_counts o
     LEFT JOIN ptexts p ON p.plvar = o.plvar
     ORDER BY o.plvar;`
  );
  return rows;
}

/**
 * 5. Relationships per Plan Version: count HRP1001 RELAT grouped by PLVAR,
 * mapped to T777P PTEXT filtered by SPRAS = 'E'.
 */
export async function getRelationshipsPerPlanVersion() {
  const { rows } = await query(
    `WITH ptexts AS (
       SELECT DISTINCT ON (plvar) plvar, ptext
       FROM om_t777p
       WHERE spras = 'E' AND plvar IS NOT NULL
       ORDER BY plvar
     ),
     rel_counts AS (
       SELECT plvar, COUNT(*)::int AS relationship_count
       FROM om_hrp1001
       WHERE plvar IS NOT NULL AND relat IS NOT NULL AND relat <> ''
       GROUP BY plvar
     )
     SELECT
       r.plvar,
       COALESCE(p.ptext, 'NA') AS ptext,
       r.relationship_count AS no_of_relationships
     FROM rel_counts r
     LEFT JOIN ptexts p ON p.plvar = r.plvar
     ORDER BY r.plvar;`
  );
  return rows;
}

/**
 * 6. Authorization Profiles: count assigned vs unassigned PROFL from T77PQ
 * based on presence in T77UA.
 */
export async function getAuthProfilesSummary() {
  const { rows } = await query(
    `WITH pq AS (
       SELECT DISTINCT profl
       FROM om_t77pq
       WHERE profl IS NOT NULL AND profl <> ''
     ),
     ua AS (
       SELECT DISTINCT profl
       FROM om_t77ua
       WHERE profl IS NOT NULL AND profl <> ''
     )
     SELECT
       COUNT(*) FILTER (WHERE ua.profl IS NOT NULL)::int AS assigned_auth_profiles,
       COUNT(*) FILTER (WHERE ua.profl IS NULL)::int AS unassigned_auth_profiles,
       COUNT(*)::int AS total
     FROM pq
     LEFT JOIN ua ON ua.profl = pq.profl;`
  );
  return rows[0] ?? { assigned_auth_profiles: 0, unassigned_auth_profiles: 0, total: 0 };
}

