-- Migration 009: PE module extension tables (EP10-EP15)
-- Adds staging tables for payroll schemas, PCR, functions/operations, and unused payroll areas.

CREATE TABLE IF NOT EXISTS pe_t52c0 (
  schem TEXT,
  funco TEXT,
  parm1 TEXT
);
CREATE INDEX IF NOT EXISTS pe_t52c0_schem_idx ON pe_t52c0 (schem);

CREATE TABLE IF NOT EXISTS pe_t52c1 (
  schem TEXT,
  funco TEXT,
  parm1 TEXT
);
CREATE INDEX IF NOT EXISTS pe_t52c1_schem_idx ON pe_t52c1 (schem);

CREATE TABLE IF NOT EXISTS pe_t52c5 (
  ccycl TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pe_t52c5_ccycl_idx ON pe_t52c5 (ccycl);

CREATE TABLE IF NOT EXISTS pe_t52a0 (
  otype TEXT,
  oname TEXT NOT NULL,
  lgtxt TEXT
);
CREATE INDEX IF NOT EXISTS pe_t52a0_otype_oname_idx ON pe_t52a0 (otype, oname);

-- pe_t599b: payroll areas with their validity end dates
-- Note: endda stored as DATE (converted from SAP YYYYMMDD)
CREATE TABLE IF NOT EXISTS pe_t599b (
  abkrs TEXT NOT NULL,
  endda DATE
);
CREATE INDEX IF NOT EXISTS pe_t599b_abkrs_idx ON pe_t599b (abkrs);

-- pe_hrpy_rgdir: PE-specific staging of HRPY_RGDIR (fields: ABKRS, FPEND).
-- Separate from hc_hrpy_rgdir (headcount) which uses PERNR, ABKRS, FPPER, SRTZA.
CREATE TABLE IF NOT EXISTS pe_hrpy_rgdir (
  abkrs TEXT NOT NULL,
  fpend DATE
);
CREATE INDEX IF NOT EXISTS pe_hrpy_rgdir_abkrs_fpend_idx ON pe_hrpy_rgdir (abkrs, fpend);

