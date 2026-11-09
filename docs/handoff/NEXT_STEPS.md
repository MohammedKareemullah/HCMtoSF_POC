# Next Steps

## 1. Where work stopped

**Last feature worked on:** implemented the second KPI section **hcm_core** (infotype category summary from T582A, subtype counts per infotype from T591A, infotype/subtype detail table with English text from T582S). Added migration `003_hcm_core.sql`, mock data in `mock/mockData.js`, unit tests in `tests/unit.test.js`, and e2e test in `tests/hcm_core.e2e.test.js`.

After that, the owner asked only for this handoff documentation. There is **no half-written code**: nothing is in progress in the source tree.

**Not yet known (blocking real confidence):** whether the owner has applied the patch, and whether they have run the backend against the real MCP server. Their messages suggest they know the SAP schema, but no real-run output, error log or real response sample has ever been shared.
Treat the whole SAP-facing path as unproven until section 2 is done.

## 2. Immediate actions (in order)

| P | Action | Done when |
|---|---|---|
| P0 | `npm install && npm test` in the owner's environment | 20/20 pass |
| P0 | Run the first-run checks in SETUP_AND_EXECUTION.md section 8 against the real MCP server (`inspect:table` for the five tables; `rowSkips` check) | Real `sap_table_read` response shape documented in MCP_SERVERS.md (replace the UNKNOWN rows); parser extended + unit-tested if needed |
| P0 | Run `POST /api/headcount/sync` against real SAP; compare `rowCounts` with SAP table sizes | Counts match expectations; any field-not-found error resolved (edit `headcount.constants.js`, keep tests green) |
| P0 | Ask the owner to confirm: hire codes (`HIRE_MASSN_CODES`), "current record" rule, payroll `SRTZA` filter, handling of "Unknown" buckets, "interns, etc." meaning | Answers recorded in IMPLEMENTATION_HISTORY.md (section 6) and reflected in code/tests/docs |
| P1 | Fix known bug B1 (`rows.push(...batch)` → loop/concat) + add a unit test with a large batch | Test passes with > 200k rows |
| P1 | Escape `%`/`_` in the PERNR `search` filter; decide whether search should pad with zeros | e2e test for a search containing `%` |
| P1 | Ask the owner for a **complete** country list (20 codes missing) and regenerate (`SETUP_AND_EXECUTION.md` section 11) | `countryNames.js` has 249 entries; update the count assertion |
| P1 | Decide and implement API authentication (and tighten `CORS_ORIGIN`) before any non-local deployment | Auth middleware + tests; AGENTS.md/docs updated |
| P2 | Next KPI sections (the owner will provide the requirements): see checklist below | Each new module ships with migration, mocks, tests, docs |
| P2 | Frontend integration (owner postponed it); the frontend should call `POST /api/headcount/sync` on load and then the GETs | Contract unchanged or documented |
| P2 | Operational hardening: structured logging with request IDs, `/health` that optionally checks MCP, CI (lint + `npm test`), git repository, Dockerfile if wanted | n/a |

## 3. Checklist: adding KPI section N

1. Get the owner's requirements and the exact SAP tables/fields; write them into PROJECT_OVERVIEW.md (as done for headcount).
2. Create `src/modules/<name>/` with `<name>.{constants,fetcher,loader,repository,processor,service,controller,routes}.js` (copy the headcount structure; do not copy its business rules).
3. New migration `00N_<name>.sql` with `<prefix>_*` staging tables (+ any view). Never edit earlier migrations.
4. Fetch through `readSapTable`; load with `replaceStaging`-style single transaction; create its own `SyncCoordinator` and `sync_runs` module name.
5. SQL in the repository, pure shaping in the processor; routes + `ensureFresh` pattern; register in `src/modules/index.js`.
6. Extend `mock/mockData.js` with the new tables **without breaking existing expectations** (or update them deliberately); add e2e tests with hand-computed expected values and unit tests for pure logic.
7. Update DATABASE_SCHEMA.md, BACKEND_DOCUMENTATION.md, MCP_SERVERS.md (new tables read), CURRENT_STATUS.md, this file.

## 4. Unfinished details a new agent must know

- `README.md` (repo root) is a short run guide that overlaps with these docs; keep it consistent if you change commands/env vars.
- `.env.example` lists `SAP_PAGE_SIZE=5000`, `SAP_MAX_PAGES=2000`, `SAP_FETCH_CONCURRENCY=2`, `SYNC_RETRY_COOLDOWN_MS=60000`; these were chosen without knowledge of real table sizes.
- The standalone `sap-mcp-node/` package from turn 1 is **not** in this repo and is superseded by `src/integrations/mcp/`; do not resurrect it.
- The country PDF generator (`reference/gen_countries.py`) expects `pdftotext -layout` output and encodes the known "page footer overlaps one row" quirk of that specific PDF; a different export format needs a different parser.
- The e2e header comment in `tests/headcount.e2e.test.js` is the specification of the mock dataset's expected KPI values; keep it in sync with `mock/mockData.js`.
- Delivering to the owner: send **only changed files** (patch zip with the same relative paths), and say what was verified against the mock only.

## 5. Open questions for the owner

1. Real `MCP_URL`, how the server is run, and a sample `sap_table_read` response (or permission to run the inspection script and share its output).
2. Which `MASSN` codes mean "hire" (re-hires? transfers in?). Should hires be counted from the first-ever record per employee instead?
3. Should "current" mean "valid today" (`BEGDA <= today <= ENDDA`) rather than "latest ENDDA"?
4. Payroll: count only current results (`SRTZA = 'A'`)? Include only certain payroll areas (`ABKRS`)?
5. What does "interns, etc." refer to: `PERSG`/`PERSK` values? Provide the mapping if a breakdown is wanted.
6. Should employee group/subgroup show names (read `T501T`/`T503T`)? Should company/plant be shown with names?
7. Hires by country: country **at hire time** or **current** country?
8. Complete SAP country list (20 rows missing from the PDF).
9. Deployment target, expected concurrency and data volumes (affects memory/paging/auth decisions).
10. Future KPI sections: names, tables, calculations.
