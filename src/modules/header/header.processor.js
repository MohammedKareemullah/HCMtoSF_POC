/**
 * Header processor — pure shaping of staged RFC_GET_SYSTEM_INFO fields.
 */

/**
 * Shape the 4 RFCSI_EXPORT fields into the API output.
 * @param {{rfcsysid?: string|null, rfcopsys?: string|null, rfcdbsys?: string|null, rfcdest?: string|null}|null} row
 */
export function buildSystemInfo(row) {
  return {
    systemName: row?.rfcsysid ?? null,
    operatingSystem: row?.rfcopsys ?? null,
    databaseSystem: row?.rfcdbsys ?? null,
    logicalDestination: row?.rfcdest ?? null,
  };
}

