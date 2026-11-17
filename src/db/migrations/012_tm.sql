-- Migration 012: TM (Time Management) staging tables
-- Tables: T508A, T550A, T551A, T550P, T554S, PA2001, PA2002

CREATE TABLE IF NOT EXISTS tm_t508a (
  schkz TEXT,
  zmodn TEXT
);
CREATE INDEX IF NOT EXISTS tm_t508a_schkz_idx ON tm_t508a (schkz);

CREATE TABLE IF NOT EXISTS tm_t550a (
  tprog TEXT NOT NULL,
  btbeg TEXT,
  btend TEXT,
  etbeg TEXT,
  etend TEXT,
  sobeg TEXT,
  soend TEXT,
  motpr TEXT
);
CREATE INDEX IF NOT EXISTS tm_t550a_tprog_idx ON tm_t550a (tprog);

CREATE TABLE IF NOT EXISTS tm_t551a (
  zmodn TEXT NOT NULL,
  tprg1 TEXT,
  tprg2 TEXT,
  tprg3 TEXT,
  tprg4 TEXT,
  tprg5 TEXT,
  tprg6 TEXT,
  tprg7 TEXT
);
CREATE INDEX IF NOT EXISTS tm_t551a_zmodn_idx ON tm_t551a (zmodn);

CREATE TABLE IF NOT EXISTS tm_t550p (
  motpr TEXT,
  pamod TEXT
);
CREATE INDEX IF NOT EXISTS tm_t550p_motpr_idx ON tm_t550p (motpr);

CREATE TABLE IF NOT EXISTS tm_t554s (
  subty TEXT NOT NULL,
  art01 TEXT
);
CREATE INDEX IF NOT EXISTS tm_t554s_subty_art01_idx ON tm_t554s (subty, art01);

CREATE TABLE IF NOT EXISTS tm_pa2001 (
  subty TEXT NOT NULL,
  begda DATE,
  endda DATE
);
CREATE INDEX IF NOT EXISTS tm_pa2001_subty_idx ON tm_pa2001 (subty);

CREATE TABLE IF NOT EXISTS tm_pa2002 (
  subty TEXT NOT NULL,
  begda DATE,
  endda DATE
);
CREATE INDEX IF NOT EXISTS tm_pa2002_subty_idx ON tm_pa2002 (subty);

