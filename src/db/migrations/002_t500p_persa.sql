-- T500P's personnel-area key is PERSA (it matches PA0001-WERKS), not WERKS.
-- Rename the staging column to match, and rebuild hc_employee_current so the join reads
--   PA0001.WERKS = T500P.PERSA   ->   T500P.LAND1
-- Every country figure (by-country, employee table, hires by country) comes from this view.
-- Staging tables are fully reloaded on each sync, so no data needs converting.
ALTER TABLE hc_t500p RENAME COLUMN werks TO persa;
ALTER INDEX hc_t500p_werks_idx RENAME TO hc_t500p_persa_idx;

CREATE OR REPLACE VIEW hc_employee_current AS
WITH p0 AS (
  SELECT DISTINCT ON (pernr) pernr, stat2
  FROM hc_pa0000
  ORDER BY pernr, endda DESC NULLS LAST, begda DESC NULLS LAST
),
p1 AS (
  SELECT DISTINCT ON (pernr) pernr, bukrs, werks, persg, persk, abkrs
  FROM hc_pa0001
  ORDER BY pernr, endda DESC NULLS LAST, begda DESC NULLS LAST
),
t5 AS (
  SELECT DISTINCT ON (persa) persa, land1
  FROM hc_t500p
  ORDER BY persa, land1
),
t1 AS (
  SELECT DISTINCT ON (bukrs) bukrs, butxt
  FROM hc_t001
  ORDER BY bukrs, butxt
)
SELECT
  p0.pernr,
  p0.stat2,
  p1.bukrs,
  t1.butxt,
  p1.werks,
  t5.land1,
  p1.persg,
  p1.persk,
  p1.abkrs
FROM p0
LEFT JOIN p1 ON p1.pernr = p0.pernr
LEFT JOIN t5 ON t5.persa = p1.werks
LEFT JOIN t1 ON t1.bukrs = p1.bukrs;
