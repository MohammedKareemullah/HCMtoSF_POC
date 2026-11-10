# Current Project Status

Status date: 2026-11-08. Legend: **VERIFIED (mock)** = covered by the automated tests / live run against the mock MCP server. **UNVERIFIED (real SAP)** = never run against the real Hypercare MCP/SAP.

## 1. Fully implemented features

| Feature | Evidence |
|---|---|
| Express API skeleton, CORS, JSON, `/health`, 404 + central error handler | e2e tests |
| PostgreSQL integration, auto-create DB, migration runner (001, 002), upgrade path 001 → 002 | e2e `before()` + manual upgrade run |
| MCP client (JWT, JSON-RPC, JSON + SSE, timeout, error mapping) | e2e against the mock (mock is spec-by-assumption) |
| Table reader with paging, duplicate-page and max-page guards, response normalisation | unit + e2e (paging verified: skips 0, 7, 14, 16) |
| Sync pipeline (fetch all → atomic replace → `sync_runs`) | e2e |
| Freshness model: first-read sync, shared in-flight, `POST /sync`, `?refresh=true`, stale fallback + cooldown | unit (`SyncCoordinator`) + e2e (SAP down) |
| KPI 1: employees per STAT2 status (distinct PERNR) | e2e (8/2/1/1 on mock) |
| KPI 2: employees per country (PA0001-WERKS = T500P-PERSA → LAND1; names from SAP list) | e2e |
| KPI 3: employees per company code (T001 names) | e2e |
| KPI 4: employee table with status text, country, company, group, subgroup; filters + pagination + validation | e2e |
| KPI 5: distinct employees in payroll per `FPPER` present | e2e |
| KPI 6: hires per year and per year × country | e2e |
| HCM Core KPI 1: infotype category counts (distinct INFTY from T777D categorized into PA, OM, TM, SAP Reserved, Recruitment, E-Recruiting & Learning, Custom) | unit + e2e |
| HCM Core KPI 2: number of subtypes per infotype (distinct SUBTY from T591A) | unit + e2e |
| HCM Core KPI 3: infotype/subtype detail table with category and English text from T582S (SPRSL='E') | unit + e2e |
| PA KPI 1: single screen (EDYNR) & list screen (LDYNR) classifications from T582A | unit + e2e |
| PA KPI 2: module pool mapping (T588M REPNA where DYNNR != ADYNR mapped to T777D INFTY) | unit + e2e |
| PA KPI 3: field visibility summary (DBILD symbol counts -, *, +, . per infotype) | unit + e2e |
| PA KPI 4: dynamic action count per infotype (distinct T588Z primary keys) | unit + e2e |
| PA KPI 5: dynamic action triggers (KENNZ = 'I' with parsed target infotype & optional 'W' line defaults) | unit + e2e |
| PA KPI 6: dynamic actions by OPERA operation code | unit + e2e |
| PA KPI 7: dynamic action routines (KENNZ = 'F', routine name inside parentheses) | unit + e2e |
| `/overview` aggregate, `/sync`, `/sync/status` | e2e |
| Mock MCP server + synthetic dataset; `inspect:table` diagnostic | used by tests / scripts |

Test totals: **18 unit pass** (on Node 22 without Postgres) + full e2e suites (`headcount.e2e.test.js`, `hcm_core.e2e.test.js`, `pa.e2e.test.js`).

## 2. Implemented but UNVERIFIED against the real system

- Everything that talks to the real MCP server: URL/JWT acceptance (including the 1 h TTL), `sap_table_read` response shape, **`rowSkips` paging**, row padding/delimiters, date format `YYYYMMDD`, zero-padded PERNR.
- SAP field availability: `T500P-PERSA` (owner-confirmed), `PA0000-STAT2/MASSN/BEGDA/ENDDA`, `PA0001-BUKRS/WERKS/PERSG/PERSK/ABKRS`, `T001-BUKRS/BUTXT`, `HRPY_RGDIR-PERNR/ABKRS/FPPER/SRTZA` (the MCP server may restrict tables/fields).
- Business definitions (hire code `01`, current-record rule, payroll `SRTZA` handling), see PROJECT_OVERVIEW.md section 3.3.
- Performance and memory with real table sizes (whole tables are held in memory during a sync).

## 3. Partially implemented

| Item | What exists | What is missing |
|---|---|---|
| Country names | 229 of 249 codes from the SAP list; ICU fallback for the other 20 (`CF CG CH CI GM GN GP GQ LI LK LR LS PA PE PF PG TG TH TJ TK`) | SAP wording for those 20 (source PDF is missing rows) |
| Employee group / subgroup | Codes only (`persg`, `persk`) | Names (would need `T501T`/`T503T`) |
| MCP tool wrappers | `sapConnectionCheck`, `sapFunctionCall`, `sapLockEntries` exist | Not used by the backend; `/health` does not check SAP |
| Config | `NODE_ENV` parsed | Unused |
| Security | JWT to MCP server; parameterised SQL | No API auth/rate limiting/headers; `PGSSL` skips certificate verification |
| Documentation of real server | Tool names + sample args | Schemas, outputs (UNKNOWN) |

## 4. Not implemented

- **Authentication/authorization for the API** (CORS defaults to `*`; HR data at PERNR level is exposed).
- Frontend (out of scope by the owner's choice).
- KPI sections other than headcount and hcm_core (owner will supply any further ones).
- "Interns, etc." breakdown (owner's wording in requirement 1; not mappable to STAT2).
- Scheduled/background refresh, incremental sync, server-side filtering, history/trends of staging data.
- Request logging/IDs, metrics, structured logger, rate limiting, security headers.
- Cross-process sync lock (multi-instance deployments would each sync).
- CI, linting, formatting, Dockerfile, git repository (the authoring copy was not under git), TypeScript.
- Data masking/anonymisation.

## 5. Known bugs and limitations

| # | Severity | Description | Where |
|---|---|---|---|
| B1 | Medium (latent) | `rows.push(...batch)` can throw `RangeError: Maximum call stack size exceeded` when one MCP page is very large (measured on Node 22: fine at 125k rows, fails at 200k), e.g. with a huge `SAP_PAGE_SIZE` (the advertised workaround for servers that ignore `rowSkips`). Fix: push in a loop or `concat` | `src/integrations/mcp/sapTableReader.js` (`readSapTable`) |
| B2 | Low | `search` filter uses `ILIKE $4 \|\| '%'` without escaping `%`/`_` typed by the user | `headcount.repository.js` `getEmployees` |
| B3 | Low (UX) | PERNR prefix search needs leading zeros (SAP PERNR is zero-padded; mock `00001002`) | same |
| B4 | Low | Loader silently drops rows with an empty required column (`pernr`, `persa`, `bukrs`); counts reported are post-filter | `headcount.loader.js` |
| B5 | Design limit | "Current record" ignores today's date; future-dated records can be treated as current | view `hc_employee_current` |
| B6 | Design limit | Hires by country use the employee's current country, not the country at hire time | `getHiresByYearAndCountry` |
| B7 | Operational | During a sync's load transaction, `TRUNCATE` blocks KPI reads until commit (short; fetch happens before) | loader |
| B8 | Operational | e2e test runs `DROP SCHEMA public CASCADE` on `TEST_DATABASE_URL` | `tests/headcount.e2e.test.js` |
| B9 | Low | A SAP value containing `\|` breaks row parsing (throws with a clear message) | `sapTableReader.js` |

No other defects are known in tested paths. Real-system defects: UNKNOWN until the first real run.

## 6. Technical debt

1. No auth (see above). 2. Whole tables buffered in Node memory, then bulk-inserted (fine for tens of thousands of rows; unknown for millions). 3. In-memory sync state (single instance only).
4. Manual query validation; no schema library. 5. `console.*` logging only. 6. Homegrown migration runner (no down-migrations, no checksum).
7. Three unused tool wrappers and an unused config key. 8. Heuristic response parser exists only because the real shape is unknown: replace with an exact parser once known (keep the loud failures).
9. Test data is a small synthetic set; no large-volume or real-shape tests. 10. No lint/format/CI. 11. README duplicates part of this documentation; keep consistent.

## 7. Pending database changes

None required. Candidates if performance demands: composite index `hc_pa0000 (pernr, endda DESC, begda DESC)` and same on `hc_pa0001`; materialising `hc_employee_current`. A new KPI section requires its own migration (`003_*.sql`, never edit 001/002).

## 8. Pending MCP integrations

Confirm real `sap_table_read` shape and `rowSkips`; optionally call `sap_connection_check` from `/health`; evaluate `sap_kpi_read`/`sap_kpi_catalog` for server-computed KPIs; decide whether an `initialize` handshake/session is ever needed;
use `sap_metadata_introspect` to confirm field names if a table read fails. No MCP resources/prompts are implemented or planned.

## 9. Outstanding configuration requirements

- `.env` must contain `DATABASE_URL` (or `PG*`), plus the existing `MCP_URL`, `MCP_JWT_SECRET`, `SAP_*`.
- Owner to confirm `HIRE_MASSN_CODES` and whether to set `PAYROLL_SRTZA_FILTER` (e.g. `A`).
- `CORS_ORIGIN` must be set to the frontend origin when a frontend exists.
- TLS: if the MCP endpoint uses a self-signed certificate, the Node process needs a trusted CA (development shortcut: `NODE_TLS_REJECT_UNAUTHORIZED=0`; never in production).
- PostgreSQL user needs `CREATEDB` for auto-creation (or create the DB manually).
- Production process management, HTTPS termination and secrets management: UNKNOWN / not set up.

## 10. Verification evidence (what was actually run)

20/20 tests; live run of `npm start` + mock MCP + curl for all endpoints (responses reproduced in BACKEND_DOCUMENTATION.md); upgrade of an existing 001-migrated database to 002 with old staging data; patch re-applied over the original zip in a clean directory and re-tested.
