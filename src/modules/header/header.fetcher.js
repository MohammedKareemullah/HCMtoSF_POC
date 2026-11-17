import { sapFunctionCall } from "../../integrations/mcp/sapTools.js";
import { McpError } from "../../shared/errors/AppError.js";
import { cleanText } from "../../shared/utils/sapValues.js";
import { RFC_FUNCTION, RFC_PARAMETERS, SYSTEM_INFO_COLUMNS } from "./header.constants.js";

const EXPECTED_KEYS = new Set(SYSTEM_INFO_COLUMNS.map((c) => c.sap));

function isPlainObject(val) {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

/** Look up a key case-insensitively inside a plain object. */
function findPropCaseInsensitive(obj, targetKey) {
  if (!isPlainObject(obj)) return undefined;
  if (targetKey in obj) return obj[targetKey];
  const lower = targetKey.toLowerCase();
  const matchedKey = Object.keys(obj).find((k) => k.toLowerCase() === lower);
  return matchedKey ? obj[matchedKey] : undefined;
}

/**
 * Extract and validate the RFCSI_EXPORT dictionary from an RFC_GET_SYSTEM_INFO response.
 * Fails loudly on unrecognised shapes instead of returning empty data silently.
 * @param {unknown} raw
 * @returns {{ RFCSYSID: string|null, RFCOPSYS: string|null, RFCDBSYS: string|null, RFCDEST: string|null }}
 */
export function normalizeSystemInfoResponse(raw) {
  const candidates = [
    raw,
    raw?.data,
    raw?.result,
    raw?.exports,
    raw?.output,
    raw?.returning,
  ];

  let rfcsi = null;
  for (const container of candidates) {
    const found = findPropCaseInsensitive(container, "RFCSI_EXPORT");
    if (isPlainObject(found)) {
      rfcsi = found;
      break;
    }
  }

  if (!rfcsi) {
    throw new McpError("Unrecognised RFC_GET_SYSTEM_INFO response: missing RFCSI_EXPORT dictionary");
  }

  const hasAnyExpectedKey = Object.keys(rfcsi).some((k) => EXPECTED_KEYS.has(k.toUpperCase()));
  if (!hasAnyExpectedKey) {
    throw new McpError(
      "Unrecognised RFC_GET_SYSTEM_INFO RFCSI_EXPORT dictionary: none of RFCSYSID, RFCOPSYS, RFCDBSYS, RFCDEST present",
    );
  }

  return {
    RFCSYSID: cleanText(findPropCaseInsensitive(rfcsi, "RFCSYSID")),
    RFCOPSYS: cleanText(findPropCaseInsensitive(rfcsi, "RFCOPSYS")),
    RFCDBSYS: cleanText(findPropCaseInsensitive(rfcsi, "RFCDBSYS")),
    RFCDEST: cleanText(findPropCaseInsensitive(rfcsi, "RFCDEST")),
  };
}

/**
 * Execute RFC_GET_SYSTEM_INFO via MCP sap_function_call with { DESTINATION: "" }
 * and return the normalised RFCSI_EXPORT fields.
 */
export async function fetchHeaderSource() {
  const raw = await sapFunctionCall(RFC_FUNCTION, RFC_PARAMETERS);
  return normalizeSystemInfoResponse(raw);
}

