-- Migration 008: Replace T500L with T500T (with SPRAS) in PE, and replace T778P with T777P (with SPRAS) in OM
-- Applied once; never edited after first run.

CREATE TABLE IF NOT EXISTS pe_t500t (
  spras TEXT NOT NULL,
  molga TEXT NOT NULL,
  ltext TEXT
);
CREATE INDEX IF NOT EXISTS pe_t500t_molga_spras_idx ON pe_t500t (molga, spras);

CREATE TABLE IF NOT EXISTS om_t777p (
  spras TEXT NOT NULL,
  plvar TEXT NOT NULL,
  ptext TEXT
);
CREATE INDEX IF NOT EXISTS om_t777p_plvar_spras_idx ON om_t777p (plvar, spras);

