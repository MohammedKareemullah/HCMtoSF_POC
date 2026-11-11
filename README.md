# SAP KPI Backend

Node + Express + PostgreSQL backend. Data is pulled from SAP through the Hypercare MCP server,
staged in Postgres, processed per KPI section, and exposed as JSON APIs for the frontend.

KPI sections implemented:
- **headcount** – employment status, country, company code, employee table, payroll per month, hires per year.
- **hcm_core** – infotype catalogue: category breakdown, subtype counts per infotype, full infotype/subtype detail table.

## Run it

```bash
npm install
cp .env.example .env.local   # or merge the new keys into your existing .env
npm run db:setup             # creates the database if missing + applies migrations (optional, `npm start` does it too)
npm start                    # http://localhost:4000
```

Your existing `.env` keys (`MCP_URL`, `MCP_JWT_SECRET`, `SAP_*`) are used as they are.
New keys are listed in `.env.example` (mainly `DATABASE_URL`).

Before the first real run, check what your MCP server returns for `sap_table_read`:

```bash
npm run inspect:table -- PA0000 PERNR,STAT2 5
```

No SAP at hand? `npm run mock:mcp` starts a fake MCP server on :8000 (secret `mock-secret`) with a small dataset.
Tests: `npm test` (needs Postgres; set `TEST_DATABASE_URL` if yours differs from `postgres://postgres:postgres@127.0.0.1:5432/hr_kpi_test`).

## Structure

```
src/
  server.js / app.js           start-up (migrate, listen) and express wiring
  config/                      env.js (all env vars), db.js (pg pool, transactions)
  db/                          migrate.js + migrations/*.sql
  integrations/mcp/            mcpClient.js (JWT, JSON-RPC, SSE), sapTools.js, sapTableReader.js (paging + row parsing)
  shared/                      errors, middleware, bulkInsert, sync (coordinator + sync_runs), utils
  modules/
    index.js                   registers each KPI module's routes
    headcount/
      headcount.constants.js   SAP tables/fields -> Postgres columns, STAT2 labels
      headcount.fetcher.js     SAP -> raw records (via MCP)
      headcount.loader.js      raw records -> Postgres staging tables (one transaction)
      headcount.repository.js  SQL: filters, joins, aggregations
      headcount.processor.js   pure: labels, country names, response shapes
      headcount.service.js     orchestration: sync + KPI reads
      headcount.controller.js / headcount.routes.js
    hcm_core/
      hcm_core.constants.js    SAP tables/fields, infotype category ranges, categoriseInfotype()
      hcm_core.fetcher.js      SAP -> raw records (T582A, T591A, T582S)
      hcm_core.loader.js       raw records -> Postgres staging tables (one transaction)
      hcm_core.repository.js   SQL: distinct infotypes, subtype counts, infotype/subtype text join
      hcm_core.processor.js    pure: category aggregation, subtype totals, detail shaping
      hcm_core.service.js      orchestration: sync + KPI reads
      hcm_core.controller.js / hcm_core.routes.js
mock/                          fake MCP server + dataset
tests/                         unit + end-to-end tests
```

Adding a KPI section = a new folder under `modules/` with the same files, its own `<prefix>_*` staging tables
in a new migration (`002_*.sql`), and one line in `modules/index.js`.

## How data flows

```
SAP --MCP sap_table_read (paged)--> fetcher --> loader --> Postgres staging tables (hc_*)
                                                                  |
                    frontend <-- controller <-- processor <-- repository (SQL on view hc_employee_current)
```

- **Fresh on app open:** the frontend calls `POST /api/headcount/sync` once when it loads and waits for it.
  If it skips that, the first KPI `GET` after a server start triggers the same fetch.
  Later reads come from Postgres. `?refresh=true` on any GET forces a new fetch.
- Concurrent callers share one SAP fetch.
- All five tables are read first, then swapped into Postgres in **one transaction**; a failed sync never leaves half-loaded data.
- If SAP is unreachable but an earlier sync exists, GETs serve that data with `meta.stale = true` and a `meta.warning`
  (SAP is not retried for `SYNC_RETRY_COOLDOWN_MS`). `POST /sync` returns 502.
- Every attempt is logged in `sync_runs` (status, duration, rows per table, error).

## API

All GETs return `{ data, meta: { lastSyncedAt, stale, warning? } }`.

| Method | Path | Returns |
|---|---|---|
| POST | `/api/headcount/sync` | Fetch from SAP now; `{ runId, status, rowCounts, durationMs }` |
| GET | `/api/headcount/sync/status` | Syncing flag, last success, latest run |
| GET | `/api/headcount/overview` | Everything below except the employee table, in one call |
| GET | `/api/headcount/status-summary` | Employees per STAT2: Active, Inactive, Retiree, Withdrawn (+ total) |
| GET | `/api/headcount/by-country` | Employees per country (name from code) |
| GET | `/api/headcount/by-company-code` | Employees per company code (with BUTXT) |
| GET | `/api/headcount/employees` | Employee table; query: `status`, `country`, `companyCode`, `search` (PERNR prefix), `page`, `pageSize` (max 500). Use `UNKNOWN` for country/companyCode to find unmapped employees |
| GET | `/api/headcount/payroll-by-month` | Distinct employees in payroll per FPPER present in HRPY_RGDIR |
| GET | `/api/headcount/hires-per-year` | `byYear` (year, hires) and `byCountry` (year, country, hires) |
| POST | `/api/hcm-core/sync` | Fetch HCM Core tables (T777D, T591A, T582S) from SAP now |
| GET | `/api/hcm-core/sync/status` | Syncing flag, last success, latest run for HCM Core |
| GET | `/api/hcm-core/infotype-categories` | Count of infotypes per category (PA, OM, TM, SAP Reserved, Recruitment, E-Recruiting & Learning, Custom Infotypes) |
| GET | `/api/hcm-core/subtypes-per-infotype` | Number of distinct subtypes under each infotype |
| GET | `/api/hcm-core/infotype-detail` | Infotypes with noOfSubtypes, functional category, and English infotype text (T582S with SPRSL='E') |
| POST | `/api/pa/sync` | Fetch PA tables (T582A, T777D, T588M, T588Z) from SAP now |
| GET | `/api/pa/sync/status` | Syncing flag, last success, latest run for PA |
| GET | `/api/pa/single-screen-classification` | Classification of single screen (`EDYNR`) per infotype from T582A |
| GET | `/api/pa/list-screen-classification` | Classification of list screen (`LDYNR`) per infotype from T582A |
| GET | `/api/pa/module-pool-mapping` | T588M module pools (`REPNA`) where `DYNNR ≠ ADYNR` mapped to T777D `INFTY` |
| GET | `/api/pa/field-visibility-summary` | Summary of hidden (`-`), display (`*`), required (`+`), and optional (`.`) fields per infotype |
| GET | `/api/pa/dynamic-action-count` | Total dynamic actions configured per infotype from T588Z |
| GET | `/api/pa/dynamic-action-triggers` | Logic blocks with KENNZ = 'I' extracting target infotype and subsequent 'W' line defaults |
| GET | `/api/pa/dynamic-action-by-operation` | Distinct dynamic action blocks grouped by OPERA operation code |
| GET | `/api/pa/dynamic-action-routines` | KENNZ = 'F' routines parsed from VINFO with unique routine count, names, and total executions |
| POST | `/api/om/sync` | Fetch OM tables (T778O, T778V, T778A, HRP1000, HRP1001, T777P, T77PQ, T77UA) from SAP now |
| GET | `/api/om/sync/status` | Syncing flag, last success, latest run for OM |
| GET | `/api/om/object-types` | Count of standard (not starting with 9) vs custom (starts with 9) OM object types from T778O |
| GET | `/api/om/relationships` | Count of standard vs custom (starts with Z or 900–999) OM relationships from T778V |
| GET | `/api/om/evaluation-paths` | Count of standard vs custom (starts with Z) OM evaluation paths from T778A |
| GET | `/api/om/objects-per-plan-version` | Count of objects (OTYPE from HRP1000) grouped by plan version (PLVAR) with description (PTEXT from T777P with SPRAS='E') |
| GET | `/api/om/relationships-per-plan-version` | Count of relationships (RELAT from HRP1001) grouped by plan version (PLVAR) with description (PTEXT from T777P with SPRAS='E') |
| GET | `/api/om/auth-profiles` | Count of assigned vs unassigned structural authorization profiles from T77PQ mapped to T77UA |
| POST | `/api/pe/sync` | Fetch PE tables (T549A, T549R, PA0001, T549N, T549B, T549C, T549D, T512W, T500T, PA0008, PA0014, PA0015, PA0267, T512T) from SAP now |
| GET | `/api/pe/sync/status` | Syncing flag, last success, latest run for PE |
| GET | `/api/pe/payroll-area-summary` | Count of standard vs custom (starts with Z or Y) payroll areas from T549A |
| GET | `/api/pe/period-parameter-summary` | Count of standard vs custom (between 50–99) period parameters from T549R |
| GET | `/api/pe/employees-per-payroll-area` | Count of employees (distinct PERNR) under each payroll area from PA0001 |
| GET | `/api/pe/payroll-areas-per-period` | Count of payroll areas (ABKRS) per period parameter (PERMO) from T549A mapped to T549N ATEXT (SPRAS='E') |
| GET | `/api/pe/company-features-summary` | Count of distinct company features: standard from T549B vs custom from T549C |
| GET | `/api/pe/feature-functions` | From T549D (FUNID='P'), unique features, function count, and list of functions (dropping number suffix) |
| GET | `/api/pe/wage-type-summary` | Categorize wage types (LGART from T512W): custom (starts with Z, Y, or digit 0–9) vs standard |
| GET | `/api/pe/wage-types-per-country` | Count of wage types grouped by MOLGA from T512W mapped to country name from T500T (SPRAS='E') |
| GET | `/api/pe/active-wage-types` | Active wage types from PA0008 (LGA01–40), PA0014, PA0015, PA0267 within last 24m mapped to T512T text (SPRSL='E') |
| GET | `/api/pe/payroll-schema-summary` | Distinct SCHEM counts: standard (from T52C0) vs custom (from T52C1) |
| GET | `/api/pe/payroll-schema-subschemas` | Subschema counts (PARM1 where FUNCO='COPY') grouped by SCHEM for both T52C0 (std) and T52C1 (custom) |
| GET | `/api/pe/pcr-summary` | Count of custom (starts with Z, Y, 9) vs standard Personnel Calculation Rules from T52C5 |
| GET | `/api/pe/payroll-functions-operations-summary` | Summary of functions (OTYPE='FU') and operations (OTYPE='OP') from T52A0 with std vs custom (starts with Y or Z) |
| GET | `/api/pe/custom-functions-operations` | List of custom functions (FU) and operations (OP) starting with Z or Y from T52A0 with type label and description (LGTXT) |
| GET | `/api/pe/unused-payroll-areas` | Unused payroll areas: configured in T599B but not present in HRPY_RGDIR within the last 24 months, with end date |
| GET | `/health` | DB ping |

## Business rules (and the choices behind them)

### Headcount
1. **One row per employee:** PA0000 and PA0001 can hold several records per PERNR (history). The current record is the one with the
   latest ENDDA, then latest BEGDA. For that, `BEGDA`/`ENDDA` are read in addition to the fields you listed.
2. **PA0001 never adds employees:** it is joined onto PA0000's PERNRs only. Employees without a PA0001 row, or whose plant/company
   has no match in T500P/T001, are counted under **Unknown** so the totals still add up to the PA0000 headcount.
3. **Hires:** a PA0000 record whose `MASSN` is in `HIRE_MASSN_CODES` (default `01`, the standard "Hiring" action), counted by
   year of `BEGDA`, as distinct PERNRs. Years with no hires do not appear. The country split uses each employee's current country.
4. **Payroll:** distinct PERNR per `FPPER` for every period present. By default all rows count; set `PAYROLL_SRTZA_FILTER=A`
   to count only current (non-superseded) results.
5. **Country names** come from the ISO code via Node's `Intl.DisplayNames` (no extra SAP read). Employee group / subgroup are
   shown as codes (`PERSG`/`PERSK`); names would need T501T/T503T.
6. **T500P key:** you specified `WERKS`; in standard SAP the personnel-area key of T500P is `PERSA`. If the read fails with a field-not-found
   error, set `T500P_WERKS_FIELD=PERSA`.

### HCM Core
1. **Infotype categorization (T777D):** Distinct INFTY values from T777D are categorized into:
   - `0000 – 0999`: Personnel Administration (PA)
   - `1000 – 1999`: Organizational Management (OM)
   - `2000 – 2999`: Time Management (TM)
   - `3000 – 3999`: SAP Reserved
   - `4000 – 4999`: Recruitment
   - `5000 – 5999`: E-Recruiting & Learning
   - `9000 – 9999`: Custom Infotypes
   - Categories with 0 infotypes are still listed with `infotypeCount: 0`. Any value outside these ranges is categorized as `Unknown`.
2. **Subtypes per infotype (T591A):** Distinct `SUBTY` values are counted per `INFTY`. Non-null subtypes only. Infotypes with no subtype entries in T591A are omitted.
3. **Infotype detail table (T777D + T591A + T582S):** Deduplicated by infotype from T777D, outputting `infotype`, `noOfSubtypes` (0 if none in T591A), `category`, and `infotypeText` (`SPRSL = 'E'`, "NA" if unmapped).

### PA (Personnel Administration)
1. **Screen Classification (T582A):**
   - Single screen (`EDYNR`): 2000 = Universal Standard, 2001–2899 = Country Specific, 2900–2999 = Fast Entry Screens, 0100–0999 or 9000–9999 = Custom, else = Others.
   - List screen (`LDYNR`): 3000 = Universal Standard, 3001–3999 = Country Specific, 0100–0999 or 9000–9999 = Custom, else = Others.
2. **Module Pool Mapping (T588M + T777D):** T588M rows where `DYNNR ≠ ADYNR` (excluding blanks, non-deduplicated REPNA) joined to T777D (`T588M.REPNA = T777D.REPID`). Module pools missing from T777D are excluded.
3. **Field Visibility Summary (T588M + T777D):** Tallies DBILD string indicator characters (`-` Hidden, `*` Display, `+` Required, `.` Optional) for all T588M records mapped to infotypes via T777D.
4. **Dynamic Action Count (T588Z):** Counts distinct primary key records `(INFTY, SUBTY, FNAME, OPERA, SEQNO)` grouped by `INFTY`.
5. **Dynamic Action Triggers (T588Z):** Groups logic blocks by `(INFTY, SUBTY, FNAME, OPERA)` ordered by `SEQNO`, filtering for `KENNZ = 'I'`. Extracts source infotype, subtype, trigger field, operation code, parsed 4-digit target infotype (`(?:INS|COP|MOD)[,( ]*(\d{4})`), and default values from any immediately following `KENNZ = 'W'` line.
6. **Dynamic Actions by Operation (T588Z):** Groups distinct logic blocks by `OPERA` code (`00` Independent, `02` Change, `04` Create, `06` Change/Create, `08` Delete, `10` Change/Delete, `12` Create/Delete) with friendly descriptions.
7. **Dynamic Action Routines (T588Z):** Filters `KENNZ = 'F'`, extracts routine name inside parentheses `\(([^)]+)\)` from `VINFO`, and calculates `COUNT(DISTINCT Routine)` and total routine executions per infotype.

### OM (Organizational Management)
1. **OM Object Types (T778O):** Non-null `OTYPE` values. Standard = does not start with `'9'`, Custom = starts with `'9'`.
2. **OM Relationships (T778V):** Non-null `RELAT` values. Custom = starts with `'Z'`/`'z'` OR numeric range 900–999. Standard = neither.
3. **OM Evaluation Paths (T778A):** Non-null `WEGID` values. Standard = does not start with `'Z'`/`'z'`, Custom = starts with `'Z'`/`'z'`.
4. **Objects per Plan Version (HRP1000 + T777P):** Counts object instances grouped by `PLVAR`, joined to `T777P` for plan version name `PTEXT` filtered by `SPRAS = 'E'` ("NA" if unmapped).
5. **Relationships per Plan Version (HRP1001 + T777P):** Counts relationship records grouped by `PLVAR`, joined to `T777P` for plan version name `PTEXT` filtered by `SPRAS = 'E'` ("NA" if unmapped).
6. **Authorization Profiles (T77PQ + T77UA):** Deduplicated `PROFL` from `T77PQ`. Assigned = exists in `T77UA` (has at least one assigned user), Unassigned = not found in `T77UA`.

### PE (Payroll Engine / Payroll)
1. **Payroll Areas (T549A):** Non-null distinct `ABKRS`. Custom = starts with `'Z'` or `'Y'`, Standard = outside Z* and Y*.
2. **Period Parameters (T549R):** Non-null distinct `PERMO`. Custom = numeric range 50–99, Standard = outside 50–99.
3. **Employees per Payroll Area (PA0001):** Deduplicates `PERNR` first to eradicate time-slice duplicates, counting distinct employees under each `ABKRS`.
4. **Payroll Areas per Period Parameter (T549A + T549N):** Counts distinct `ABKRS` per `PERMO` from `T549A`, joined with `T549N` for `ATEXT` (`SPRAS = 'E'`).
5. **Company Features (T549B + T549C):** Distinct `NAMEN` from `T549B` as standard company features; distinct `NAMEN` from `T549C` as custom company features.
6. **Feature Functions (T549D):** Filters `FUNID = 'P'`, groups by `NAMEN`, counting distinct functions and listing function names with number suffixes stripped (e.g. "CALC 01" -> "CALC").
7. **Wage Type Summary (T512W):** Categorizes distinct `LGART`: Custom = starts with `'Z'`, `'Y'`, or digit `0`–`9`; Standard = other prefixes.
8. **Wage Types per Country (T512W + T500T):** Groups `T512W` by `MOLGA`, counts distinct wage types, joined with `T500T` (`SPRAS = 'E'`) for country name `LTEXT`.
9. **Active Wage Types (PA0008, PA0014, PA0015, PA0267 + T512T):** Extracts distinct wage types from `PA0008` (`LGA01`–`LGA40`), `PA0014`, `PA0015`, and `PA0267` where `BEGDA <= CURRENT_DATE` and `ENDDA >= CURRENT_DATE - 24 months`, mapped to `T512T` for English description `LGTXT` (`SPRSL = 'E'`).
10. **Payroll Schema Summary (T52C0 + T52C1):** Distinct `SCHEM` counts: standard payroll schemas from `T52C0` vs custom payroll schemas from `T52C1`.
11. **Payroll Schema Subschemas (T52C0 + T52C1):** Filters `FUNCO = 'COPY'`, counts distinct `PARM1` (subschemas) per `SCHEM`, providing separate lists for standard (`T52C0`) and custom (`T52C1`).
12. **Personnel Calculation Rules / PCR Summary (T52C5):** Categorizes distinct `CCYCL`: Custom = starts with `'Z'`, `'Y'`, or `'9'`; Standard = outside Z, Y, 9.
13. **Payroll Functions & Operations Summary (T52A0):** Evaluates `T52A0` for functions (`OTYPE = 'FU'`) and operations (`OTYPE = 'OP'`), counting custom (`ONAME` starts with `'Y'` or `'Z'`) vs standard.
14. **Custom Functions and Operations (T52A0):** Lists custom entries from `T52A0` where `ONAME` starts with `'Z'` or `'Y'`, returning type label (`"Function"` for FU, `"Operation"` for OP), name, and description (`LGTXT`).
15. **Unused Payroll Areas (T599B + HRPY_RGDIR):** Identifies distinct payroll areas (`ABKRS`) configured in `T599B` that have not appeared in `HRPY_RGDIR` within the last 24 months (`FPEND >= CURRENT_DATE - 24 months`), returning payroll area and validity end date (`ENDDA`).

## Notes

- The MCP client signs an HS256 JWT with Node's `crypto`. For a self-signed `https://localhost` endpoint, run with
  `NODE_TLS_REJECT_UNAUTHORIZED=0` in development only.
- `sap_table_read` is paged with `rowCount` + `rowSkips` (`SAP_PAGE_SIZE`, default 5000). If your server ignores `rowSkips`, the reader
  detects the repeated page and stops with a clear error; set `SAP_PAGE_SIZE` above the largest table's row count in that case.
- The staging tables hold personal data (PA0000/PA0001 by PERNR). Restrict database access accordingly.
