-- Migration 013: Header module staging table for RFC_GET_SYSTEM_INFO (RFCSI_EXPORT)

CREATE TABLE IF NOT EXISTS hdr_system_info (
  rfcsysid TEXT,
  rfcopsys TEXT,
  rfcdbsys TEXT,
  rfcdest  TEXT
);

