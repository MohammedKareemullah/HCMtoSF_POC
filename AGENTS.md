# AGENTS.md: instructions for AI coding agents

You are continuing an existing, working project. Do not restart it, do not re-architect it. Read first, then make small, tested,
documented changes.

## 0. Before you touch any code

1. Read everything in `docs/handoff/`, in the order given in `docs/handoff/README.md`. Minimum: PROJECT_OVERVIEW, SYSTEM_ARCHITECTURE,
   MCP_SERVERS, DATABASE_SCHEMA, CURRENT_STATUS, NEXT_STEPS.
2. Skim the code: `src/modules/headcount/*` is the reference implementation of a KPI section; `src/integrations/mcp/*` is the SAP access layer.
3. Run `npm install && npm test` and confirm 20/20 pass **before** changing anything (needs PostgreSQL; see SETUP_AND_EXECUTION.md).
4. Anything marked **UNKNOWN** in the docs is genuinely unknown. Ask the project owner or verify against the real system; never guess.

## 1. What this project is (one paragraph)

A Node.js (Express, ESM, plain JavaScript) backend that pulls SAP HCM tables through an external **Hypercare MCP server**
(`sap_table_read`, JSON-RPC over HTTP with a Bearer JWT), stages them in **PostgreSQL**, computes KPI sections with SQL plus small pure
processors, and serves JSON APIs for a future frontend. One KPI section exists (**headcount**); more will follow, each as its own module.

## 2. Hard rules

- **Preserve working behaviour.** Do not rewrite working modules. Prefer additive changes. If you must change behaviour, change the
  matching test and doc in the same change and say so.
- **Migrations are append-only.** Never edit `src/db/migrations/001_init.sql` or `002_t500p_persa.sql`; add `003_*.sql` etc. The runner
  applies files in filename order, each in a transaction, and records them in `schema_migrations`. Never drop or rename existing
  tables/columns without a migration that preserves upgrade from an already-migrated database (test that path).
- **Do not change the staging model casually.** Staging tables (`hc_*`) are a full-replace copy of SAP tables, reloaded in one transaction.
  The data is re-creatable from SAP, but the table/column names are part of the contract with `headcount.constants.js` and the view.
- **The MCP layer is a thin client over a server you do not own.** The response shape of `sap_table_read` has never been seen from the real
  server. `src/integrations/mcp/sapTableReader.js` is deliberately tolerant and deliberately **throws** on anything unrecognised. Never
  make it return empty data silently. If the real shape differs, extend `normalizeTableRows` and add a unit test for the new shape.
- **No secrets in the repo, logs, tests or docs.** `.env` is git-ignored. The JWT contains the SAP password (signed, not encrypted):
  never log tokens or the `sap` payload.
- **Treat staging data as personal data (PERNR-level HR data).** Do not add features that export it wholesale; do not put real HR data in
  fixtures; the mock dataset is synthetic.
- **The API currently has no authentication.** Do not deploy it outside a trusted network until auth exists (see CURRENT_STATUS.md).
- **Never run the e2e test against a database you care about.** `tests/headcount.e2e.test.js` executes `DROP SCHEMA public CASCADE` on
  the database named by `TEST_DATABASE_URL` (default: a local `hr_kpi_test`).

## 3. Architecture you must respect

```
routes -> controller -> service -> repository (SQL on staging tables / view) -> processor (pure) -> { data, meta }
                            \-> sync: coordinator -> fetcher (MCP) -> loader (Postgres, one transaction)
```

- Each KPI section is a folder `src/modules/<name>/` with files `<name>.{constants,fetcher,loader,repository,processor,service,controller,routes}.js`,
  its own staging tables prefixed `<prefix>_`, a new migration, and **one line** in `src/modules/index.js`.
- **Joins, filters, dedup and aggregation happen in SQL** (repository). **Labels, names and response shaping happen in Node**
  (processor, pure functions, no I/O). Controllers contain HTTP concerns only. Services orchestrate.
- Freshness model: the first KPI read after a server start triggers a live SAP fetch; concurrent callers share one fetch; `POST .../sync`
  and `?refresh=true` force one; on SAP failure with an earlier successful sync, reads serve stale data flagged `meta.stale`. Reuse
  `SyncCoordinator` for new modules; do not invent a second mechanism.
- Response envelope for KPI reads: `{ data, meta: { lastSyncedAt, stale, warning? } }`. Errors: `{ error: { code, message, details? } }`.

## 4. Code conventions (match the existing code)

- ESM only (`"type": "module"`), imports with explicit `.js` extensions, Node >= 20, built-in `fetch`, built-in `node:test`. No TypeScript, no ORM,
  no query builder: plain `pg` with **parameterised** SQL (`$1, $2`). Never concatenate user input into SQL.
- 2-space indent, double quotes, semicolons, trailing commas in multi-line literals. File names `<module>.<role>.js`; shared code in `src/shared/`.
- Errors: throw `AppError` subclasses (`ValidationError` 400, `McpError` 502). Controllers/handlers are wrapped in `asyncHandler`. The central
  `errorHandler` formats the response.
- Env access only through `src/config/env.js` (one place, with defaults). Document every new variable in `.env.example` and in
  `docs/handoff/BACKEND_DOCUMENTATION.md`.
- Comments explain *why* (assumptions, SAP quirks), not what.
- SAP values: dates arrive as `YYYYMMDD` and are converted by `sapDate`; everything is trimmed by `cleanText`; empty becomes `NULL`.

## 5. Verification (required)

- Run `npm test` after every change. All tests must pass. Add tests with new behaviour: unit tests for pure logic, e2e tests for endpoints.
- New KPI logic needs fixture rows in `mock/mockData.js` **and** hand-computed expected values written in the e2e test header (the existing
  header is the model). Changing existing mock rows changes existing expected values; update them deliberately.
- Behaviour that depends on the real SAP/MCP server cannot be proven by the mock. State clearly in your summary what was verified against the
  mock only. Use `npm run inspect:table -- <TABLE> <FIELDS> [rowCount]` against the real server for shape questions.
- If you change a migration-affecting behaviour, also test the upgrade path on a database that already has the previous migrations applied.

## 6. Documentation duty

Update the relevant file in `docs/handoff/` in the same change whenever you alter architecture, an endpoint, a schema object, an env var,
MCP behaviour, a business rule, or status. Move items between "implemented / partial / not implemented" in CURRENT_STATUS.md. Keep NEXT_STEPS.md current.
Never delete a documented decision without recording why in IMPLEMENTATION_HISTORY.md.

## 7. Working with the project owner (preferences observed in the conversation)

- When asked for a change, deliver **only the modified files** (as a patch folder/zip with the same relative paths), not the whole project again.
- The owner supplies business rules incrementally ("I'll let you know"). Do not invent KPI definitions; when a rule is ambiguous, state the
  assumption you made, make it configurable where cheap, and flag it for confirmation (this is how `HIRE_MASSN_CODES` was handled).
- The owner corrects SAP facts from their system (e.g. T500P key is `PERSA`, not `WERKS`). Treat their statements about SAP as authoritative over
  general SAP knowledge, and over this repo's assumptions.
- The frontend is deliberately out of scope for now.

## 8. Quick command reference

```bash
npm install
npm run db:setup          # create DB if allowed + apply migrations
npm start                 # API on PORT (default 4000); also migrates on boot
npm run mock:mcp          # fake MCP server on :8000 (no SAP needed)
npm run inspect:table -- PA0000 PERNR,STAT2 5   # see the real sap_table_read response shape
npm test                  # unit + e2e (needs PostgreSQL)
```

Details, env vars and troubleshooting: `docs/handoff/SETUP_AND_EXECUTION.md`.
