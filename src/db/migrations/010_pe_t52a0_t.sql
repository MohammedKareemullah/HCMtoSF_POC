-- Migration 010: PE module T52A0_T text table for functions and operations
CREATE TABLE IF NOT EXISTS pe_t52a0_t (
  otype TEXT,
  oname TEXT NOT NULL,
  lgtxt TEXT
);
CREATE INDEX IF NOT EXISTS pe_t52a0_t_otype_oname_idx ON pe_t52a0_t (otype, oname);

