-- Migration 015: PE module T549BT feature text table

CREATE TABLE IF NOT EXISTS pe_t549bt (
  feature_language TEXT NOT NULL,
  feature TEXT NOT NULL,
  title TEXT
);
CREATE INDEX IF NOT EXISTS pe_t549bt_feature_lang_idx ON pe_t549bt (feature, feature_language);

