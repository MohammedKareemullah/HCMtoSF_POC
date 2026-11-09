-- ---------------------------------------------------------------------------
-- HCM Core module: add hcm_t777d table for infotype definitions
-- Replaces hcm_t582a for infotype categories per requirement.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hcm_t777d (
  infty TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hcm_t777d_infty_idx ON hcm_t777d (infty);

