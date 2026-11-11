-- Migration 007: PE (Payroll Engine / Payroll) module staging tables
-- Applied once; never edited after first run.

CREATE TABLE IF NOT EXISTS pe_t549a (
  abkrs TEXT NOT NULL,
  permo TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pe_t549a_abkrs_idx ON pe_t549a (abkrs);
CREATE INDEX IF NOT EXISTS pe_t549a_permo_idx ON pe_t549a (permo);

CREATE TABLE IF NOT EXISTS pe_t549r (
  permo TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pe_t549r_permo_idx ON pe_t549r (permo);

CREATE TABLE IF NOT EXISTS pe_pa0001 (
  pernr TEXT NOT NULL,
  abkrs TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pe_pa0001_abkrs_idx ON pe_pa0001 (abkrs);
CREATE INDEX IF NOT EXISTS pe_pa0001_pernr_idx ON pe_pa0001 (pernr);

CREATE TABLE IF NOT EXISTS pe_t549n (
  spras TEXT NOT NULL,
  permo TEXT NOT NULL,
  atext TEXT
);
CREATE INDEX IF NOT EXISTS pe_t549n_permo_idx ON pe_t549n (permo);

CREATE TABLE IF NOT EXISTS pe_t549b (
  namen TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pe_t549b_namen_idx ON pe_t549b (namen);

CREATE TABLE IF NOT EXISTS pe_t549c (
  namen TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pe_t549c_namen_idx ON pe_t549c (namen);

CREATE TABLE IF NOT EXISTS pe_t549d (
  namen TEXT NOT NULL,
  funid TEXT NOT NULL,
  funct TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pe_t549d_namen_idx ON pe_t549d (namen);
CREATE INDEX IF NOT EXISTS pe_t549d_funid_idx ON pe_t549d (funid);

CREATE TABLE IF NOT EXISTS pe_t512w (
  molga TEXT NOT NULL,
  lgart TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pe_t512w_molga_idx ON pe_t512w (molga);
CREATE INDEX IF NOT EXISTS pe_t512w_lgart_idx ON pe_t512w (lgart);

CREATE TABLE IF NOT EXISTS pe_t500l (
  molga TEXT NOT NULL,
  ltext TEXT
);
CREATE INDEX IF NOT EXISTS pe_t500l_molga_idx ON pe_t500l (molga);

CREATE TABLE IF NOT EXISTS pe_pa0008 (
  begda DATE NOT NULL,
  endda DATE NOT NULL,
  lga01 TEXT,
  lga02 TEXT,
  lga03 TEXT,
  lga04 TEXT,
  lga05 TEXT,
  lga06 TEXT,
  lga07 TEXT,
  lga08 TEXT,
  lga09 TEXT,
  lga10 TEXT,
  lga11 TEXT,
  lga12 TEXT,
  lga13 TEXT,
  lga14 TEXT,
  lga15 TEXT,
  lga16 TEXT,
  lga17 TEXT,
  lga18 TEXT,
  lga19 TEXT,
  lga20 TEXT,
  lga21 TEXT,
  lga22 TEXT,
  lga23 TEXT,
  lga24 TEXT,
  lga25 TEXT,
  lga26 TEXT,
  lga27 TEXT,
  lga28 TEXT,
  lga29 TEXT,
  lga30 TEXT,
  lga31 TEXT,
  lga32 TEXT,
  lga33 TEXT,
  lga34 TEXT,
  lga35 TEXT,
  lga36 TEXT,
  lga37 TEXT,
  lga38 TEXT,
  lga39 TEXT,
  lga40 TEXT
);
CREATE INDEX IF NOT EXISTS pe_pa0008_dates_idx ON pe_pa0008 (begda, endda);

CREATE TABLE IF NOT EXISTS pe_pa0014 (
  begda DATE NOT NULL,
  endda DATE NOT NULL,
  lgart TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pe_pa0014_dates_idx ON pe_pa0014 (begda, endda);
CREATE INDEX IF NOT EXISTS pe_pa0014_lgart_idx ON pe_pa0014 (lgart);

CREATE TABLE IF NOT EXISTS pe_pa0015 (
  begda DATE NOT NULL,
  endda DATE NOT NULL,
  lgart TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pe_pa0015_dates_idx ON pe_pa0015 (begda, endda);
CREATE INDEX IF NOT EXISTS pe_pa0015_lgart_idx ON pe_pa0015 (lgart);

CREATE TABLE IF NOT EXISTS pe_pa0267 (
  begda DATE NOT NULL,
  endda DATE NOT NULL,
  lgart TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pe_pa0267_dates_idx ON pe_pa0267 (begda, endda);
CREATE INDEX IF NOT EXISTS pe_pa0267_lgart_idx ON pe_pa0267 (lgart);

CREATE TABLE IF NOT EXISTS pe_t512t (
  sprsl TEXT NOT NULL,
  lgart TEXT NOT NULL,
  lgtxt TEXT
);
CREATE INDEX IF NOT EXISTS pe_t512t_sprsl_lgart_idx ON pe_t512t (sprsl, lgart);

