# Setup and Execution Guide

All commands run from the repository root. Examples use a POSIX shell; Windows notes are given where they differ.

## 1. Prerequisites

- Node.js **>= 20** (developed on 22). npm 10.
- PostgreSQL (tested on 16; nothing version-specific is used beyond `DISTINCT ON`, `unnest`, `jsonb`, window functions). A user that can create databases (or an already-created database).
- For the real data path: network access to the Hypercare MCP server and its JWT secret. Not needed for the mock.

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment variables

Create `.env` in the repo root (it is git-ignored; never commit it). Start from `.env.example`, which documents every variable. Required for a real run:

```
MCP_URL=<your MCP endpoint>              MCP_JWT_SECRET=<shared signing secret>
SAP_ASHOST=<host> SAP_SYSNR=<nn> SAP_CLIENT=<nnn> SAP_USER=<user> SAP_PASSWD=<password> SAP_LANG=EN
DATABASE_URL=postgres://<user>:<password>@localhost:5432/hr_kpi        # URL-encode special characters in the password
```

Optional: `PORT` (4000), `CORS_ORIGIN`, `HIRE_MASSN_CODES` (01), `PAYROLL_SRTZA_FILTER`, `SAP_PAGE_SIZE` (5000), `SAP_MAX_PAGES`, `SAP_FETCH_CONCURRENCY`, `SYNC_RETRY_COOLDOWN_MS`, `PGSSL`, `SAP_HTTP_*`. Full table: BACKEND_DOCUMENTATION.md section 7.
Variables already exported in the shell win over `.env` (dotenv does not override).

## 4. Set up PostgreSQL

Either let the app create the database (requires `CREATEDB`), or create it yourself:

```bash
createdb hr_kpi              # or: psql -c "CREATE DATABASE hr_kpi;"
```

## 5. Run database migrations

```bash
npm run db:setup             # creates DB if missing, applies pending migrations (001, 002)
```

`npm start` runs the same step on boot. Verify:

```bash
psql "$DATABASE_URL" -c "select name, applied_at from schema_migrations order by name;"
psql "$DATABASE_URL" -c "\dt"      # hc_* staging tables, sync_runs, schema_migrations
```

Never edit an applied migration; add a new numbered file in `src/db/migrations/`.

## 6. Start the MCP server(s)

**Mock (no SAP needed):**

```bash
npm run mock:mcp                                  # listens on :8000 (MOCK_PORT); prints the dummy JWT secret it expects
# in .env: MCP_URL=http://127.0.0.1:8000/hypercare-mcp   MCP_JWT_SECRET=<the secret printed by the runner>
```

**Real Hypercare MCP server:** started by its owner (procedure UNKNOWN). Point `MCP_URL` at it. Sanity-check with the owner's Python script
(`python docs/handoff/reference/hypercare_mcp_test_script.py --tool sap_connection_check`; it expects the server project's env files next to it, or pass `--url` and `--secret`).

## 7. Start the backend

```bash
npm start                    # http://localhost:4000  (migrates on boot)
npm run dev                  # same with node --watch
```

Smoke test:

```bash
curl -s localhost:4000/health
curl -s -X POST localhost:4000/api/headcount/sync        # live pull from the MCP server into Postgres; returns row counts per table
curl -s localhost:4000/api/headcount/overview
curl -s "localhost:4000/api/headcount/employees?status=3&pageSize=5"
curl -s localhost:4000/api/headcount/sync/status
```

Without calling `/sync`, the first KPI GET after a server start performs the sync itself (so it is slower).

## 8. First run against the REAL MCP server (do this before trusting any number)

```bash
# 1. See the raw response shape and how the app normalises it
npm run inspect:table -- PA0000 PERNR,STAT2 5
npm run inspect:table -- T500P PERSA,LAND1 5
npm run inspect:table -- T001 BUKRS,BUTXT 5
npm run inspect:table -- HRPY_RGDIR PERNR,ABKRS,FPPER,SRTZA 5
npm run inspect:table -- PA0001 PERNR,BEGDA,ENDDA,BUKRS,WERKS,PERSG,PERSK,ABKRS 5

# 2. Does rowSkips page? The two outputs must contain DIFFERENT rows (use a table with > 2 rows)
node --input-type=module -e '
import { sapTableRead } from "./src/integrations/mcp/sapTools.js";
const a = await sapTableRead({ table: "T001", fields: ["BUKRS"], rowCount: 2, rowSkips: 0 });
const b = await sapTableRead({ table: "T001", fields: ["BUKRS"], rowCount: 2, rowSkips: 2 });
console.log(JSON.stringify(a)); console.log(JSON.stringify(b));'

# 3. Full sync, then compare row counts with SAP (e.g. SE16N counts)
curl -s -X POST localhost:4000/api/headcount/sync
```

If the shape is not recognised, extend `normalizeTableRows` in `src/integrations/mcp/sapTableReader.js` and add a unit test with the real shape. If `rowSkips` is ignored, set `SAP_PAGE_SIZE` above the largest table's row count
(but see known bug B1 in CURRENT_STATUS.md for very large tables).

## 9. Run tests

```bash
npm test                     # unit + e2e (node --test --test-concurrency=1)
```

Needs a reachable PostgreSQL. The e2e test uses database `hr_kpi_test` (created automatically if the user has `CREATEDB`); override with `TEST_DATABASE_URL`.
**It runs `DROP SCHEMA public CASCADE` on that database. Point it only at a disposable database.** The default connection string is a hard-coded local development default inside the test file.
Single file: `node --test tests/unit.test.js`.

## 10. Debugging common errors

| Symptom | Likely cause / fix |
|---|---|
| `MCP HTTP 401 ...` | `MCP_JWT_SECRET` differs from the server's; token claims missing |
| `MCP request ... failed: fetch failed (DEPTH_ZERO_SELF_SIGNED_CERT / UNABLE_TO_VERIFY_LEAF_SIGNATURE)` | Self-signed HTTPS. Dev only: `NODE_TLS_REJECT_UNAUTHORIZED=0 npm start` (PowerShell: `$env:NODE_TLS_REJECT_UNAUTHORIZED=0`) |
| `... failed: fetch failed (ECONNREFUSED)` | MCP server not running / wrong `MCP_URL` |
| `MCP request ... timed out after 180000ms` | Large table or slow SAP; raise `MCP_TIMEOUT_MS`, lower `SAP_PAGE_SIZE` |
| `Unrecognised sap_table_read response (...)` | Real response shape not supported yet: run `inspect:table`, extend `normalizeTableRows` |
| `sap_table_read returned a row with N column(s) but M were requested` | Delimiter `\|` inside a value, or the response is not table data / has extra columns |
| `... returned the same page again at rowSkips=...` | Server ignores `rowSkips`: set `SAP_PAGE_SIZE` above the row count |
| `Tool sap_table_read failed: ... field ... not found` | A field name is wrong for this system; verify with `sap_metadata_introspect` / SAP; edit `headcount.constants.js` |
| `Exceeded SAP_MAX_PAGES` | Raise `SAP_MAX_PAGES` or `SAP_PAGE_SIZE` |
| `RangeError: Maximum call stack size exceeded` in the reader | Known bug B1 (huge page); lower `SAP_PAGE_SIZE` |
| `Database "x" does not exist and the maintenance database ... is not reachable` | Create the DB manually or fix credentials / `PG_ADMIN_DATABASE` |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL not running |
| `password authentication failed` | Wrong `DATABASE_URL`/`PG*`; URL-encode special characters |
| Responses show `meta.stale: true` | Live refresh failed; read `meta.warning`; `GET /api/headcount/sync/status` shows the failed run's error |
| `sync_runs` row stuck `running` | Process was killed mid-sync; it is auto-failed at next start |
| HTTP 400 `status must be one of 3, 1, 2, 0` | Invalid `status` filter value |
| Country shows a raw code or ICU name | Code not in `src/shared/data/countryNames.js` (the 20 gap codes use ICU names) |
| All counts are 0 / empty tables | Check `GET /sync/status` → `rowCounts`; table authorisations on the SAP/MCP side (UNKNOWN) |

Useful SQL: `select * from sync_runs order by id desc limit 5;` / `select count(*) from hc_pa0000;` / `select * from hc_employee_current limit 20;`.
To start clean: drop and recreate the database (or `TRUNCATE` the `hc_*` tables) and run a sync.

## 11. Regenerating the country list

```bash
pdftotext -layout docs/handoff/reference/LAND1_code.pdf /tmp/land1.txt
python3 -I docs/handoff/reference/gen_countries.py /tmp/land1.txt src/shared/data/countryNames.js
npm test      # unit test asserts the entry count (229); update it when the list changes
```

(Edit the entry-count assertion in `tests/unit.test.js` when you supply a complete list.)
