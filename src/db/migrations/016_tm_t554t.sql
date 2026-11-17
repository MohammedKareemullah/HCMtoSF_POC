-- Migration 016: TM module T554T attendance/absence type text table

CREATE TABLE IF NOT EXISTS tm_t554t (
  awart TEXT NOT NULL,
  atext TEXT
);
CREATE INDEX IF NOT EXISTS tm_t554t_awart_idx ON tm_t554t (awart);

