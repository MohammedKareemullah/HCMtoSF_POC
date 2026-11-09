import { McpError } from "../../shared/errors/AppError.js";
import { sapTableRead } from "./sapTools.js";

const DELIMITER = "|";

// ---------------------------------------------------------------------------
// Normalising the sap_table_read response into [{ FIELD: "value" }, ...]
//
// The tool's exact response shape is not documented in the script we were given, so this accepts
// the common shapes and FAILS LOUDLY on anything else (silently returning [] would make every KPI
// read zero). Run `npm run inspect:table -- PA0000 PERNR,STAT2` to see what your server returns.
// ---------------------------------------------------------------------------

const ROW_KEYS = ["rows", "data", "records", "items", "lines", "DATA", "ET_DATA", "result"];
const STRING_ROW_KEYS = new Set(["rows", "data", "lines", "DATA"]);

const splitLines = (s) => s.split(/\r?\n/).filter((l) => l.trim() !== "");

/** @returns {Array|null} the raw row list, or null when the shape is not recognised */
function extractRowList(result) {
  if (result === null || result === undefined) return null;
  if (Array.isArray(result)) return result;
  if (typeof result === "string") return splitLines(result);
  if (typeof result !== "object") return null;

  for (const key of ROW_KEYS) {
    if (!(key in result)) continue;
    const v = result[key];
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && STRING_ROW_KEYS.has(key)) return splitLines(v);
    if (v && typeof v === "object") {
      const inner = extractRowList(v);
      if (inner) return inner;
    }
  }
  const arrays = Object.values(result).filter(Array.isArray);
  return arrays.length === 1 ? arrays[0] : null;
}

function splitDelimited(line, fields, delimiter, sample) {
  const parts = line.split(delimiter);
  if (parts.length !== fields.length) {
    throw new McpError(
      `sap_table_read returned a row with ${parts.length} column(s) but ${fields.length} were requested ` +
        `(${fields.join(",")}). A value may contain the "${delimiter}" delimiter, or the response is not table data. ` +
        `Row: ${String(sample ?? line).slice(0, 200)}`
    );
  }
  return Object.fromEntries(fields.map((f, i) => [f, parts[i].trim()]));
}

function toRecord(item, fields, delimiter) {
  if (typeof item === "string") return splitDelimited(item, fields, delimiter);
  if (Array.isArray(item)) {
    if (item.length !== fields.length) {
      throw new McpError(`sap_table_read returned an array row of length ${item.length}, expected ${fields.length}`);
    }
    return Object.fromEntries(fields.map((f, i) => [f, String(item[i] ?? "").trim()]));
  }
  if (item && typeof item === "object") {
    const upper = Object.fromEntries(Object.entries(item).map(([k, v]) => [k.toUpperCase(), v]));
    // RFC_READ_TABLE style: { WA: "a|b|c" }
    if (!fields.some((f) => f.toUpperCase() in upper) && typeof upper.WA === "string") {
      return splitDelimited(upper.WA, fields, delimiter);
    }
    if (!fields.some((f) => f.toUpperCase() in upper)) {
      throw new McpError(
        `sap_table_read returned an object row without any requested field (${fields.join(",")}); keys: ${Object.keys(
          item
        ).join(",")}`
      );
    }
    return Object.fromEntries(fields.map((f) => [f, String(upper[f.toUpperCase()] ?? "").trim()]));
  }
  throw new McpError(`sap_table_read returned an unsupported row type: ${typeof item}`);
}

export function normalizeTableRows(result, fields, delimiter = DELIMITER) {
  const list = extractRowList(result);
  if (!list) {
    const shape = result && typeof result === "object" ? `object with keys [${Object.keys(result).join(", ")}]` : typeof result;
    throw new McpError(`Unrecognised sap_table_read response (${shape}): ${JSON.stringify(result)?.slice(0, 300)}`);
  }

  // Drop a header line such as "PERNR|STAT2" if the server echoes one.
  let rows = list;
  if (typeof rows[0] === "string") {
    const header = rows[0].split(delimiter).map((s) => s.trim().toUpperCase());
    if (header.length === fields.length && header.every((h, i) => h === fields[i].toUpperCase())) rows = rows.slice(1);
  }
  return rows.map((item) => toRecord(item, fields, delimiter));
}

// ---------------------------------------------------------------------------
// Reading a whole table, page by page
// ---------------------------------------------------------------------------

const fingerprint = (batch) => JSON.stringify([batch[0], batch[batch.length - 1], batch.length]);

/**
 * Read ALL rows of an SAP table via repeated sap_table_read calls (rowCount + rowSkips).
 * Pages advance by the number of rows actually returned (the server may cap rowCount) and
 * stop at the first empty page.
 */
export async function readSapTable({ table, fields, pageSize = 5000, maxPages = 2000 }) {
  const rows = [];
  let skips = 0;
  let firstFingerprint = null;

  for (let page = 0; page < maxPages; page++) {
    const raw = await sapTableRead({ table, fields, rowCount: pageSize, delimiter: DELIMITER, rowSkips: skips });
    const batch = normalizeTableRows(raw, fields, DELIMITER);
    if (batch.length === 0) return rows;

    const fp = fingerprint(batch);
    if (page === 0) {
      firstFingerprint = fp;
    } else if (fp === firstFingerprint) {
      throw new McpError(
        `sap_table_read for ${table} returned the same page again at rowSkips=${skips}: the server seems to ignore ` +
          `rowSkips. Set SAP_PAGE_SIZE larger than the table's row count to read it in a single call.`
      );
    }

    rows.push(...batch);
    skips += batch.length;
  }
  throw new McpError(`Reading ${table} exceeded SAP_MAX_PAGES=${maxPages} pages; raise SAP_MAX_PAGES or SAP_PAGE_SIZE.`);
}
