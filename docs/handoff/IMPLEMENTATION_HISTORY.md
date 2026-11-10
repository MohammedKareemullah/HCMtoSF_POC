# Implementation History and Decisions

This is the conversation distilled. It includes things that are **not visible in the code** (rejected designs, corrections, reasoning). "Owner" = the person the project is built for.
Dates are from message timestamps (owner's timezone, Asia/Calcutta, UTC+05:30) where known.

## 1. Timeline

| # | When | Owner asked | Outcome |
|---|---|---|---|
| 1 | before 2026-11-04 | Attached a Python script that calls every tool of their MCP server. Wants **Node programs to configure the MCP client and use only 4 tools**: `sap_connection_check`, `sap_table_read`, `sap_function_call`, `sap_lock_entries`. `.env` already prepared | Delivered a small standalone Node package `sap-mcp-node` (`mcpClient.js`, `sapTools.js`, `index.js`, `package.json`). **Not part of this repo**; its MCP client logic became `src/integrations/mcp/` |
| 2 | before 2026-11-04 | "For `index.js` alone, write the result to a JSON file; just give the snippet" | Snippet: `results` object filled by `run()`, `writeFile("test_results.json", ...)`; shape `{ tool: {status:"success",data} \| {status:"error",error} }` (same as the Python script) |
| 3 | 2026-11-04 23:57 | Building an app: fetch from SAP via MCP → calculate → display. Frontend forgotten for now. Wants a **clean Node backend structure separated per KPI section**; also thinks of storing MCP data in **MongoDB** but wants data **fetched fresh on use**; asks at what stage to store | Architecture advice (section 2, D4): layered modules per KPI, store **raw** data right after fetch (snapshot store, not cache), Mongo TTL, in-flight de-dup, stale fallback idea, PII caution |
| 4 | 2026-11-05 15:34 | **Switches to Postgres** (table filters/joins). Gives KPI section 1 spec (3 areas, 5 calculations; see PROJECT_OVERVIEW.md). Wants new structure, DB setup, writing MCP data into DB, fresh fetch on first open, **all APIs, "make sure it runs successfully"** | Built the whole backend, verified with real Postgres + mock MCP (18/18 tests, plus live curl run). Delivered `sap-kpi-backend.zip` |
| 5 | 2026-11-08 22:51 | **Correction**: T500P's field is `PERSA` (matches PA0001-`WERKS`), not `WERKS`; fix by-country **and hires-per-year country**; use the attached **country-code → name PDF**; "**don't give the entire project again, only the modified program**" | Implemented migration 002, constants change, SAP country list (229 entries), tests updated (20/20). Delivered `sap-kpi-backend-patch.zip` (14 changed files) |
| 6 | 2026-11-08 23:48 | This handoff documentation package for another AI coding agent | These documents + `AGENTS.md` |

What the owner holds locally (UNKNOWN whether applied): `sap-mcp-node/` (turn 1), the full backend zip (turn 4), and the patch zip (turn 5). The repo documented here = backend zip + patch applied + these docs.
The turn-5 patch touched: `README.md`, `.env.example`, `src/config/env.js`, `src/db/migrations/002_t500p_persa.sql` (new), `src/shared/data/countryNames.js` (new), `src/shared/utils/countryName.js` (new),
`headcount.{constants,fetcher,loader,processor}.js`, `mock/mockData.js`, `mock/mockMcpServer.js`, `tests/unit.test.js`, `tests/headcount.e2e.test.js`.

## 2. Architectural decisions

| ID | Decision | Why | Alternatives considered / rejected |
|---|---|---|---|
| D1 | Node MCP client **mirrors the Python script** (same JWT payload, same JSON-RPC `tools/call`, same SSE parsing, same env var names) | The script is the only evidence of the server contract; the owner already has the `.env` | Official `@modelcontextprotocol/sdk` (offered as an upgrade if a session handshake becomes necessary; not needed so far) |
| D2 | HS256 JWT built with Node `crypto`, TTL 1 h with renewal (Python uses `exp: 9999999999`) | No dependency; short-lived token is safer | `jsonwebtoken` library; never-expiring token. Acceptance of short TTL by the server: UNKNOWN (expected fine) |
| D3 | **Layered, per-KPI-module backend**: routes → controller → service → fetcher → processor → (mapper) | Owner asked for logic separated per KPI section; keeps calculations pure/testable | Single flat services folder; per-endpoint scripts |
| D4 | **MongoDB raw-snapshot store** (turn 3 advice) | Keep exact SAP responses, reprocess later, trends, fallback if SAP down | **Rejected by the owner in turn 4** in favour of Postgres (needs filters/joins over SAP tables) |
| D5 | **PostgreSQL with typed staging tables + SQL joins/aggregation**; Node only shapes output | Owner's KPIs are relational (dedupe, joins across 5 tables); SQL is the natural place | Postgres with raw JSONB snapshots (rejected: pushes joins into JSON queries); doing joins in Node memory (rejected: slower, harder to filter/paginate) |
| D6 | Staging = **full replace in one transaction**, only after **all** tables were fetched | Never serve half-loaded data; failed sync keeps previous data | Upsert/merge per table (complex, needs keys; SAP infotypes have repeating PERNR); append-only history (no requirement) |
| D7 | **Freshness**: first KPI read after server start syncs from SAP; concurrent callers share one fetch; `POST /sync`; `?refresh=true`; stale fallback + cooldown | Owner: "data needs to be fetched every time for the first time opening the application" yet stored in DB | Always fetch on every request (slow, hammers SAP); pure cache with TTL (not requested); stale-allowed `?refresh=false` mode from turn 3 (superseded by stale fallback) |
| D8 | "Current record" per employee = latest `ENDDA`, then `BEGDA` (`DISTINCT ON`) | PA0000/PA0001 hold history; owner said "deduplicate, keep only distinct PERNR" without defining *which* row | Latest by `BEGDA`; row valid *today*; first row. **Not confirmed by the owner** |
| D9 | Employee universe = PA0000; PA0001 never adds PERNRs; unmatched → **Unknown** buckets (not dropped) | Owner: "make sure only users from PA0000 are present, no new PERNR from PA0001". Unknown buckets keep totals reconciling with the headcount | Inner joins (silently lose employees) |
| D10 | Hire = `PA0000-MASSN` in `HIRE_MASSN_CODES` (default `01`), distinct PERNR per `BEGDA` year; also split by country | Owner listed `MASSN` for hires but never defined hire codes. Standard SAP `01` = Hiring | Count every PA0000 row's `BEGDA`; first-ever record per PERNR. **Assumption pending confirmation** |
| D11 | Country names: first `Intl.DisplayNames` (turn 4) → **SAP country list from the owner's PDF** (turn 5) with ICU fallback | Owner supplied the authoritative mapping | Reading `T005T` from SAP (extra table; not requested) |
| D12 | In-memory `SyncCoordinator` per process | Simple; single instance assumed | DB advisory lock / job queue (needed only for multi-instance; **not built**) |
| D13 | Own tiny migration runner + auto-create database on start | Owner wanted "how to initially set the database" to be easy | `node-pg-migrate`/Knex/Prisma (not adopted) |
| D14 | Tests: **real PostgreSQL + in-process mock MCP**, hand-computed expectations | Proves SQL logic and the HTTP flow; avoids mocking `pg` | Mocking the DB layer (rejected: would not test SQL) |
| D15 | Plain `pg`, Express 4, ESM, `node:test`, no ORM, no TypeScript | Few dependencies; SQL-centric; easy to hand over | Prisma/Sequelize/Knex, Fastify, Jest, TypeScript (not discussed with the owner; author's choice) |
| D16 | `sap_table_read` parser is **tolerant but fails loudly** | Real response shape never seen; silent empty data would show wrong zeros | Assume one shape (fragile); return `[]` on mismatch (dangerous) |
| D17 | PERSA fix via migration **002** (rename column + recreate view), not by editing 001 | Existing databases are already at 001; migrations are append-only | Keep the column named `werks` and just map `PERSA` → `werks` (rejected: misleading) |
| D18 | Deliver changes as a **patch of only modified files** | Owner's explicit instruction (turn 5) | Whole-project zip (the owner explicitly rejected this) |

## 3. What survived from the turn-3 advice, and what did not

| Turn-3 idea | Status |
|---|---|
| Per-KPI module with controller/service/fetcher/processor/mapper | IMPLEMENTED; "mapper" merged into `processor`; a `loader` file was added; `routes` kept |
| `integrations/mcp/` (client + sapTools) | IMPLEMENTED |
| `shared/` errors, middleware, utils | IMPLEMENTED (errors, errorHandler, utils); `requestId`, `validate` middleware **not built** |
| Fetch → save raw → process → map → respond | CHANGED: fetch → **replace staging** → (later, separately) SQL + process on reads |
| Snapshot repository, TTL index (`expireAt`), 30-day retention | NOT BUILT (Mongo dropped; staging is current-only; `sync_runs` is the only history) |
| `jobs/` for scheduled snapshot/cleanup | NOT BUILT |
| De-duplicate in-flight identical requests | IMPLEMENTED (`SyncCoordinator`) |
| Serve last snapshot with `stale: true` if MCP fails | IMPLEMENTED (`meta.stale`, `meta.warning`) |
| `?refresh=false` "serve snapshot if younger than N minutes" | NOT BUILT (different freshness model chosen) |
| `Promise.all` for several tool calls | IMPLEMENTED as bounded concurrency (`mapLimit`, default 2) |
| PII caution for PA0001/USR02 tables | Acknowledged; only needed fields are read; **no masking implemented** |

## 4. Requirement changes over time

1. Turn 1: "just call 4 MCP tools from Node" → turn 3: "a full backend that fetches, processes, serves KPI data, per section".
2. Turn 3: store in MongoDB → turn 4: **PostgreSQL** (filters/joins); fresh fetch on first open retained.
3. Turn 4: T500P described as `WERKS, LAND1` → turn 5: key field is **`PERSA`**.
4. Turn 4 country names unspecified ("fill in country name from country code") → turn 5: **use the supplied country-code list**.
5. Turn 4 hires "per year" with output "year and number of hires" while also saying "by country" → implemented **both** (`byYear` and `byCountry`).
6. Turn 5: delivery style changed to **patches only**.
7. Turn 6: implemented KPI section 2 (**HCM Core**):
   - Deduplicated infotypes from `T582A` categorized by functional area (0000–0999 PA, 1000–1999 OM, 2000–2999 TM, 3000–3999 SAP reserved, 4000–4999 Recruitment, 5000–5999 E-Recruiting & Learning, 9000–9999 Custom infotypes).
   - Distinct subtypes from `T591A` counted per infotype.
   - Infotype-subtype table with category and English infotype text from `T582S` (`SPRSL = 'EN'`).
   - Append-only migration `003_hcm_core.sql` creating `hcm_t582a`, `hcm_t591a`, `hcm_t582s`.
   - Registered under `/api/hcm-core` in `src/modules/index.js`.
   - Synthetic data in `mock/mockData.js`, unit tests in `tests/unit.test.js`, e2e test in `tests/hcm_core.e2e.test.js`.
8. Turn 7: refined KPI section 2 (**HCM Core**):
   - Changed infotype source table from `T582A` to `T777D` for `/api/hcm-core/infotype-categories`.
   - Filter `SPRSL` updated to `'E'` (single-char SAP code instead of `'EN'`).
   - `/api/hcm-core/infotype-detail` updated to return `{ infotype, noOfSubtypes, category, infotypeText }` deduplicated per infotype (0 subtypes if unmapped, "NA" if missing text).
   - Migration `004_t777d.sql` created for `hcm_t777d`.
9. Turn 8: implemented KPI section 3 (**PA - Personnel Administration**):
   - Tables: `T582A` (`INFTY, EDYNR, LDYNR`), `T777D` (`INFTY, REPID`), `T588M` (`REPNA, DYNNR, ADYNR, DBILD`), `T588Z` (`INFTY, SUBTY, FNAME, OPERA, SEQNO, KENNZ, VINFO`).
   - Append-only migration `005_pa.sql` creating `pa_t582a`, `pa_t777d`, `pa_t588m`, and `pa_t588z`.
   - Registered under `/api/pa` in `src/modules/index.js`.
   - 7 KPI requirements delivering 8 read endpoints + 2 sync endpoints:
     1. `GET /api/pa/single-screen-classification` (EDYNR: 2000 Universal Standard, 2001–2899 Country Specific, 2900–2999 Fast Entry Screens, 0100–0999/9000–9999 Custom, else Others).
     2. `GET /api/pa/list-screen-classification` (LDYNR: 3000 Universal Standard, 3001–3999 Country Specific, 0100–0999/9000–9999 Custom, else Others).
     3. `GET /api/pa/module-pool-mapping` (T588M REPNA where DYNNR != ADYNR mapped to T777D INFTY).
     4. `GET /api/pa/field-visibility-summary` (tally DBILD symbols `-`, `*`, `+`, `.` per infotype via T777D mapping).
     5. `GET /api/pa/dynamic-action-count` (distinct primary keys grouped by INFTY).
     6. `GET /api/pa/dynamic-action-triggers` (unique source infotype and list of unique target infotypes).
     7. `GET /api/pa/dynamic-action-by-operation` (distinct blocks grouped by OPERA operation code with dynamicActionCount and dynamicActionSeqCount).
     8. `GET /api/pa/dynamic-action-routines` (KENNZ = 'F', parsed routine name from parentheses in VINFO, unique routine count + total dynamic actions).
   - Added unit tests in `tests/unit.test.js` and e2e test suite `tests/pa.e2e.test.js`.
10. Turn 9: implemented KPI section 4 (**OM - Organizational Management**):
   - Tables: `T778O` (`OTYPE`), `T778V` (`RELAT`), `T778A` (`WEGID`), `HRP1000` (`OTYPE, PLVAR`), `HRP1001` (`RELAT, PLVAR`), `T778P` (`PLVAR, PTEXT`), `T77PQ` (`PROFL`), `T77UA` (`UNAME, PROFL`).
   - Append-only migration `006_om.sql` creating `om_t778o`, `om_t778v`, `om_t778a`, `om_hrp1000`, `om_hrp1001`, `om_t778p`, `om_t77pq`, and `om_t77ua`.
   - Registered under `/api/om` in `src/modules/index.js`.
   - 6 KPI requirements delivering 6 read endpoints + 2 sync endpoints:
     1. `GET /api/om/object-types` (count standard vs custom starts with 9).
     2. `GET /api/om/relationships` (count standard vs custom starts with Z or 900–999).
     3. `GET /api/om/evaluation-paths` (count standard vs custom starts with Z).
     4. `GET /api/om/objects-per-plan-version` (count OTYPE from HRP1000 per PLVAR with T778P PTEXT).
     5. `GET /api/om/relationships-per-plan-version` (count RELAT from HRP1001 per PLVAR with T778P PTEXT).
     6. `GET /api/om/auth-profiles` (count assigned vs unassigned structural profiles from T77PQ in T77UA).
   - Added unit tests in `tests/unit.test.js` (24/24 pass) and e2e test suite `tests/om.e2e.test.js`.

## 5. Bugs, errors and issues encountered, and resolutions

| # | Issue | Resolution |
|---|---|---|
| E1 | **Wrong T500P key field** (`WERKS` instead of `PERSA`). The author followed the owner's turn-4 wording; flagged it in advance as a risk (README note: "standard SAP calls it PERSA") and added a `T500P_WERKS_FIELD` override. Owner then confirmed `PERSA` | Fixed in `headcount.constants.js` (`PERSA`), migration 002 (rename column, recreate view), mock T500P rows keyed `PERSA`, e2e test asserts the fields requested are `["PERSA","LAND1"]`; removed `T500P_WERKS_FIELD` |
| E2 | **The country PDF is incomplete**: every printed page lost 4 rows at its bottom edge (page 1 ends at `CD`, page 2 starts at `CK`, etc.). Found while parsing; 229 entries + 20 missing = 249 (official ISO count) | Generated the list from the PDF as printed; the 20 missing codes (`CF CG CH CI GM GN GP GQ LI LK LR LS PA PE PF PG TG TH TJ TK`) fall back to ICU English names. **Open:** ask the owner for a complete export |
| E3 | `sap_table_read` response shape and `rowSkips` support unknown (no access to the real server) | Tolerant parser + loud failures + `npm run inspect:table` + duplicate-page detection; **still unverified** |
| E4 | Latent: `rows.push(...batch)` in `sapTableReader.js` can throw `RangeError: Maximum call stack size exceeded` if a single page is very large (measured on Node 22: fine at 125k rows, fails at 200k). Triggered if `SAP_PAGE_SIZE` is set huge (the documented workaround for servers ignoring `rowSkips`) | **Not fixed** (found during the handoff review; code was frozen). See CURRENT_STATUS.md known bugs |
| E5 | No test failures occurred during development: first full run 18/18, after the patch 20/20 (including an upgrade test of a DB migrated at 001 with old data) | n/a |

No long debugging sessions took place; the above is the complete list of problems surfaced in the conversation.

## 6. Important implementation assumptions (consolidated)

Unconfirmed by the owner: D8 (current record), D10 (hire = `MASSN 01`), payroll counts all `SRTZA` rows by default, hires by *current* country, Unknown buckets, STAT2 mapping taken from the owner's text (0 Withdrawn, 1 Inactive, 2 Retiree, 3 Active).
Technical assumptions about the real MCP server: response shape, `rowSkips`, `YYYYMMDD` dates, zero-padded PERNR, no handshake needed, `|` never appears inside values.

## 7. Discussed but never implemented

MongoDB and everything Mongo-specific; scheduled snapshot jobs; `requestId`/`validate` middleware; `?refresh=false` max-age mode; official MCP SDK; intern/employee-type breakdown ("interns, etc."); group/subgroup *names*;
data masking; frontend; any KPI section other than headcount; API authentication.

## 8. Development environment notes (authoring sandbox)

Linux container, Node 22, PostgreSQL 16 started manually (it stopped when the sandbox restarted). The sandbox could not reach the owner's MCP server, so nothing was ever executed against real SAP data.
Databases created there: `hr_kpi_test`, `hr_kpi_demo`, `hr_kpi` (disposable).
