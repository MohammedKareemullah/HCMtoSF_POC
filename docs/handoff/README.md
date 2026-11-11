# Handoff documentation: SAP KPI Backend

This folder is the complete knowledge transfer for the **SAP KPI Backend** project, written so a new AI coding agent (or developer)
with no prior context can continue the work. It combines (a) what is actually in the repository, verified by inspection and by running
it, and (b) everything decided or learned during the conversation that produced it.

Conventions used in every document:

- **IMPLEMENTED** = exists in the code. **PLANNED / DISCUSSED** = talked about but not in the code. **UNKNOWN** = not available to the
  author; do not guess, find out (usually by asking the project owner or running against the real system).
- **VERIFIED (mock)** = proven by the automated tests / a live run against the *mock* MCP server in this repo.
  **UNVERIFIED (real SAP)** = never executed against the real Hypercare MCP server or a real SAP system.
- No secrets are recorded anywhere in these documents. Environment variables are listed by name and purpose only.

## Reading order

| # | File | Read it to learn |
|---|---|---|
| 0 | `../../AGENTS.md` (repo root) | Rules of engagement for any coding agent. **Read first.** |
| 1 | [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | What the product is, the exact business requirements, SAP glossary, requirement-to-implementation map |
| 2 | [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) | Components, data flow, sync/freshness model, diagrams, auth and security posture |
| 3 | [MCP_SERVERS.md](MCP_SERVERS.md) | The external Hypercare MCP server (what is known/unknown), the MCP client, the mock server |
| 4 | [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Every table/index/view, ER diagram, migrations, the SQL business logic |
| 5 | [BACKEND_DOCUMENTATION.md](BACKEND_DOCUMENTATION.md) | Folder structure, modules, every endpoint with sample responses, env vars, dependencies |
| 6 | [IMPLEMENTATION_HISTORY.md](IMPLEMENTATION_HISTORY.md) | The conversation distilled: decisions, rejected alternatives, errors, requirement changes, assumptions |
| 7 | [CURRENT_STATUS.md](CURRENT_STATUS.md) | What works, what is partial, what is missing, known issues, technical debt |
| 8 | [SETUP_AND_EXECUTION.md](SETUP_AND_EXECUTION.md) | Exact commands: install, configure, DB, mock/real MCP, run, test, debug |
| 9 | [NEXT_STEPS.md](NEXT_STEPS.md) | Where work stopped and the ordered list of what to do next |

`reference/` holds source material that is the only ground truth for things outside this repo:

| File | What it is |
|---|---|
| `reference/hypercare_mcp_test_script.py` | The project owner's Python script that calls the real MCP server. The only evidence of the server's tool names, arguments and auth scheme. (Original file name UNKNOWN; it was supplied as `attachment.txt`.) |
| `reference/LAND1_code.pdf` | SAP country list (code to name) supplied by the owner. Source of `src/shared/data/countryNames.js`. Note: it is missing 20 rows (see CURRENT_STATUS.md). |
| `reference/gen_countries.py` | Generator that turned the PDF's text into `countryNames.js`. Usage: `pdftotext -layout LAND1_code.pdf land1.txt && python3 -I gen_countries.py land1.txt out.js` |

## Snapshot facts

- Documented state: 2026-11-10. Node.js 22 used for development (`engines.node >= 20`), PostgreSQL 16 used for testing.
- Automated tests pass: 33 unit tests in `tests/unit.test.js`, plus e2e test suites (`headcount.e2e.test.js`, `hcm_core.e2e.test.js`, `pa.e2e.test.js`, `om.e2e.test.js`, `pe.e2e.test.js`).
- Five KPI sections exist: **headcount**, **hcm_core**, **pa**, **om**, and **pe**.
- The code has never been run against the real MCP server from the authoring environment (the sandbox could not reach it).
- The repository was **not** a git repository in the authoring sandbox; the owner's local copy may differ. UNKNOWN.

## Keeping these documents true

Any change to architecture, endpoints, schema, env vars, MCP behaviour or business rules must update the matching document in the same
change (see AGENTS.md). Facts that depend on the real SAP system should be moved from UNKNOWN to a verified statement as soon as they
are confirmed.
