-- ---------------------------------------------------------------------------
-- HCM Core module: staging tables for infotype metadata.
-- Three SAP tables are staged here (full-replace on every sync):
--   hcm_t582a  T582A: infotype definitions (INFTY only; deduplication in SQL)
--   hcm_t591a  T591A: subtype definitions per infotype (INFTY + SUBTY)
--   hcm_t582s  T582S: infotype texts (SPRSL language, INFTY, ITEXT)
-- ---------------------------------------------------------------------------

CREATE TABLE hcm_t777d (
  infty TEXT NOT NULL
);
CREATE INDEX hcm_t777d_infty_idx ON hcm_t777d (infty);

CREATE TABLE hcm_t582a (
  infty TEXT NOT NULL
);
CREATE INDEX hcm_t582a_infty_idx ON hcm_t582a (infty);

CREATE TABLE hcm_t591a (
  infty TEXT NOT NULL,
  subty TEXT
);
CREATE INDEX hcm_t591a_infty_idx ON hcm_t591a (infty);

CREATE TABLE hcm_t582s (
  sprsl TEXT,
  infty TEXT NOT NULL,
  itext TEXT
);
CREATE INDEX hcm_t582s_infty_sprsl_idx ON hcm_t582s (infty, sprsl);

