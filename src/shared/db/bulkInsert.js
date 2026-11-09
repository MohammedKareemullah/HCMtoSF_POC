const IDENT = /^[a-z_][a-z0-9_]*$/;

/**
 * Fast multi-row insert using one unnest() per chunk.
 * @param client   a pg client (so it can run inside a transaction)
 * @param table    table name (from our own constants, validated anyway)
 * @param columns  [{ name, pgType }]  e.g. { name: "begda", pgType: "date" }
 * @param rows     array of arrays, values in the same order as `columns`
 */
export async function bulkInsert(client, { table, columns, rows, chunkSize = 5000 }) {
  if (!IDENT.test(table) || columns.some((c) => !IDENT.test(c.name) || !IDENT.test(c.pgType))) {
    throw new Error("bulkInsert: invalid identifier");
  }
  if (!rows.length) return 0;

  const names = columns.map((c) => c.name).join(", ");
  const unnestArgs = columns.map((c, i) => `$${i + 1}::${c.pgType}[]`).join(", ");
  const sql = `INSERT INTO ${table} (${names}) SELECT * FROM unnest(${unnestArgs})`;

  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const params = columns.map((_, colIdx) => chunk.map((row) => row[colIdx]));
    await client.query(sql, params);
  }
  return rows.length;
}
