-- Migration 014: Rename om_t777p.spras -> langu (SAP T777P language field is LANGU)

ALTER TABLE om_t777p RENAME COLUMN spras TO langu;
ALTER INDEX IF EXISTS om_t777p_plvar_spras_idx RENAME TO om_t777p_plvar_langu_idx;

