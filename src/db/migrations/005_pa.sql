-- Migration 005: PA (Personnel Administration) module staging tables
-- Applied once; never edited after first run.

CREATE TABLE IF NOT EXISTS pa_t582a (
  infty  TEXT NOT NULL,
  edynr  TEXT,
  ldynr  TEXT
);
CREATE INDEX IF NOT EXISTS pa_t582a_infty_idx ON pa_t582a (infty);

-- PA module's own copy of T777D — includes REPID for module-pool join.
-- (hcm_core has a separate hcm_t777d with only INFTY.)
CREATE TABLE IF NOT EXISTS pa_t777d (
  infty  TEXT NOT NULL,
  repid  TEXT
);
CREATE INDEX IF NOT EXISTS pa_t777d_repid_idx ON pa_t777d (repid);

CREATE TABLE IF NOT EXISTS pa_t588m (
  repna  TEXT NOT NULL,
  dynnr  TEXT,
  adynr  TEXT,
  dbild  TEXT
);
CREATE INDEX IF NOT EXISTS pa_t588m_repna_idx ON pa_t588m (repna);

CREATE TABLE IF NOT EXISTS pa_t588z (
  infty  TEXT NOT NULL,
  subty  TEXT,
  fname  TEXT,
  opera  TEXT,
  seqno  TEXT,
  kennz  TEXT,
  vinfo  TEXT
);
CREATE INDEX IF NOT EXISTS pa_t588z_infty_idx ON pa_t588z (infty);

