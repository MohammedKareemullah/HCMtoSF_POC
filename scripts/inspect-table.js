// Usage: npm run inspect:table -- PA0000 PERNR,STAT2 [rowCount]
// Shows the RAW sap_table_read response from your MCP server and how this app normalises it.
// Run this once against your real server to confirm the response shape is understood.
import { sapTableRead } from "../src/integrations/mcp/sapTools.js";
import { normalizeTableRows } from "../src/integrations/mcp/sapTableReader.js";

const [table, fieldArg, countArg] = process.argv.slice(2);
if (!table || !fieldArg) {
  console.error("Usage: npm run inspect:table -- <TABLE> <FIELD1,FIELD2,...> [rowCount=5]");
  process.exit(1);
}
const fields = fieldArg.split(",").map((f) => f.trim().toUpperCase());

try {
  const raw = await sapTableRead({ table, fields, rowCount: Number(countArg ?? 5), delimiter: "|", rowSkips: 0 });
  console.log("--- RAW response (first 1500 chars) ---");
  console.log(JSON.stringify(raw, null, 2).slice(0, 1500));
  console.log("\n--- Normalised rows ---");
  console.log(normalizeTableRows(raw, fields));
} catch (err) {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
}
