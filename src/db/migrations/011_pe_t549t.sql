-- Migration 011: PE module T549T text table for payroll areas
CREATE TABLE IF NOT EXISTS pe_t549t (
  abkrs TEXT NOT NULL,
  atext TEXT
);
CREATE INDEX IF NOT EXISTS pe_t549t_abkrs_idx ON pe_t549t (abkrs);

