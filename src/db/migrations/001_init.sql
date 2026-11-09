-- Sync bookkeeping: one row per attempt to pull a KPI module's data from SAP.
CREATE TABLE sync_runs (
  id           BIGSERIAL PRIMARY KEY,
  module       TEXT        NOT NULL,
  status       TEXT        NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  duration_ms  INTEGER,
  row_counts   JSONB,
  error        TEXT
);
CREATE INDEX sync_runs_module_idx ON sync_runs (module, id DESC);

-- ---------------------------------------------------------------------------
-- Headcount module: staging tables = latest raw copy of the SAP tables.
-- They are fully replaced (TRUNCATE + INSERT in one transaction) on every sync.
-- ---------------------------------------------------------------------------
CREATE TABLE hc_pa0000 (
  pernr TEXT NOT NULL,
  begda DATE,
  endda DATE,
  massn TEXT,
  stat2 TEXT
);
CREATE INDEX hc_pa0000_pernr_idx ON hc_pa0000 (pernr);
CREATE INDEX hc_pa0000_massn_idx ON hc_pa0000 (massn);

CREATE TABLE hc_pa0001 (
  pernr TEXT NOT NULL,
  begda DATE,
  endda DATE,
  bukrs TEXT,
  werks TEXT,
  persg TEXT,
  persk TEXT,
  abkrs TEXT
);
CREATE INDEX hc_pa0001_pernr_idx ON hc_pa0001 (pernr);

CREATE TABLE hc_t500p (
  werks TEXT,
  land1 TEXT
);
CREATE INDEX hc_t500p_werks_idx ON hc_t500p (werks);

CREATE TABLE hc_t001 (
  bukrs TEXT,
  butxt TEXT
);
CREATE INDEX hc_t001_bukrs_idx ON hc_t001 (bukrs);

CREATE TABLE hc_hrpy_rgdir (
  pernr TEXT NOT NULL,
  abkrs TEXT,
  fpper TEXT,
  srtza TEXT
);
CREATE INDEX hc_hrpy_rgdir_fpper_idx ON hc_hrpy_rgdir (fpper);

-- ---------------------------------------------------------------------------
-- One row per employee: latest PA0000 record, joined to the latest PA0001
-- record of the SAME employee only (PERNRs that exist only in PA0001 are
-- dropped by design), then to T500P (country) and T001 (company name).
-- "Latest" = highest ENDDA, then highest BEGDA.
-- ---------------------------------------------------------------------------
CREATE VIEW hc_employee_current AS
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
  SELECT DISTINCT ON (werks) werks, land1
  FROM hc_t500p
  ORDER BY werks, land1
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
LEFT JOIN t5 ON t5.werks = p1.werks
LEFT JOIN t1 ON t1.bukrs = p1.bukrs;
