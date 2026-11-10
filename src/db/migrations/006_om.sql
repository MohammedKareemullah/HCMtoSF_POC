-- Migration 006: OM (Organizational Management) module staging tables
-- Applied once; never edited after first run.

CREATE TABLE IF NOT EXISTS om_t778o (
  otype TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS om_t778o_otype_idx ON om_t778o (otype);

CREATE TABLE IF NOT EXISTS om_t778v (
  relat TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS om_t778v_relat_idx ON om_t778v (relat);

CREATE TABLE IF NOT EXISTS om_t778a (
  wegid TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS om_t778a_wegid_idx ON om_t778a (wegid);

CREATE TABLE IF NOT EXISTS om_hrp1000 (
  otype TEXT NOT NULL,
  plvar TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS om_hrp1000_plvar_idx ON om_hrp1000 (plvar);

CREATE TABLE IF NOT EXISTS om_hrp1001 (
  relat TEXT NOT NULL,
  plvar TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS om_hrp1001_plvar_idx ON om_hrp1001 (plvar);

CREATE TABLE IF NOT EXISTS om_t778p (
  plvar TEXT NOT NULL,
  ptext TEXT
);
CREATE INDEX IF NOT EXISTS om_t778p_plvar_idx ON om_t778p (plvar);

CREATE TABLE IF NOT EXISTS om_t77pq (
  profl TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS om_t77pq_profl_idx ON om_t77pq (profl);

CREATE TABLE IF NOT EXISTS om_t77ua (
  uname TEXT,
  profl TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS om_t77ua_profl_idx ON om_t77ua (profl);

