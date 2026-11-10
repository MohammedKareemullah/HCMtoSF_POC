# Project Overview

## 1. What the project does

**SAP KPI Backend** is a Node.js service that:

1. reads SAP HCM (HR) tables through an external **Hypercare MCP server** (tool `sap_table_read`),
2. stages the data in **PostgreSQL**,
3. performs filtering, joining, de-duplication and aggregation (SQL) plus labelling/shaping (Node) per **KPI section**, and
4. exposes the results as JSON REST APIs for a frontend (the frontend is **not built**; deliberately out of scope so far).

The overall application, as described by the owner: *"an application where I will be fetching data from SAP using this MCP, then doing some
calculation and processing, and then displaying the data"*, with backend logic **separated per KPI section**. Each section fetches its data
from the MCP, processes it, and gets it ready for frontend display.

## 2. Business purpose

Give HR/management a live view of workforce headcount KPIs sourced directly from SAP, without manual extracts. The first KPI section is
**Headcount** (who is employed, where, in which company, in payroll, and hiring trend). Further KPI sections are expected; the owner will
supply their calculations later. UNKNOWN: names/content of future sections, target users, deployment environment.

## 3. Functional requirements (KPI section 1: Headcount)

These are the owner's requirements, preserved as faithfully as possible. Status refers to the code at the documentation date.

### 3.1 Required source data (owner's specification)

| Purpose | SAP table | Fields the owner asked for | Fields actually read (and why) |
|---|---|---|---|
| Status + hires | `PA0000` | `PERNR`, `STAT2`, `BEGDA`, `MASSN` | + `ENDDA` (to pick the current record per employee) |
| Organisational data | `PA0001` | `PERNR`, `BUKRS`, `WERKS`, `PERSG`, `PERSK`, `ABKRS` | + `BEGDA`, `ENDDA` (current record) |
| Country of plant | `T500P` | `WERKS` (**corrected by owner to `PERSA`**), `LAND1` | `PERSA`, `LAND1` |
| Company names | `T001` | `BUKRS`, `BUTXT` | same |
| Payroll | `HRPY_RGDIR` | `PERNR`, `ABKRS`, `FPPER`, `SRTZA` | same |

### 3.2 Required calculations (owner's numbering) and how they are implemented

| # | Owner requirement | Implementation | Endpoint | Status |
|---|---|---|---|---|
| 1 | From `PA0000` `STAT2` + `PERNR`, keep **distinct PERNR**, count by status: **0 Withdrawn, 1 Inactive, 2 Retiree, 3 Active**. Output: number of employees per category. | Latest PA0000 record per PERNR; `GROUP BY stat2`; all four statuses always present (0 if none); unexpected codes surfaced as "Unknown (x)" | `GET /api/headcount/status-summary` | IMPLEMENTED, VERIFIED (mock) |
| 2a | From `PA0001` keep distinct PERNR, **only PERNRs that exist in PA0000** (PA0001 must not add employees). Count employees **per country** via `PA0001-WERKS = T500P-PERSA` → `T500P-LAND1`, **country name from country code** | View `hc_employee_current` (PA0000 LEFT JOIN latest PA0001 LEFT JOIN T500P); names from the owner-supplied SAP country list | `GET /api/headcount/by-country` | IMPLEMENTED, VERIFIED (mock) |
| 2b | Count employees **per company code** via `PA0001-BUKRS = T001-BUKRS`, show `T001-BUTXT` | same view, joined to T001 | `GET /api/headcount/by-company-code` | IMPLEMENTED, VERIFIED (mock) |
| 3 | A table of **all employees** with status text, country (name), company code, employee group, employee subgroup | Same view, paginated + filterable | `GET /api/headcount/employees` | IMPLEMENTED, VERIFIED (mock). Group/subgroup shown as codes (`PERSG`, `PERSK`), not names |
| 4 | From `HRPY_RGDIR`: **distinct employees in payroll for each month (`FPPER`)**, one row per month, *"don't assume any months, try for all the months present"* | `COUNT(DISTINCT pernr) GROUP BY fpper` over whatever periods exist | `GET /api/headcount/payroll-by-month` | IMPLEMENTED, VERIFIED (mock) |
| 5 | From `PA0000`: **hires per year (by country)** using `BEGDA`; output a table of year and number of hires | PA0000 records whose `MASSN` is a hire code (default `01`), distinct PERNR per year of `BEGDA`; also split by country | `GET /api/headcount/hires-per-year` | IMPLEMENTED, VERIFIED (mock). **Hire definition is an assumption** (see 3.3) |
| – | "Total number of active and inactive employees, **retirees, interns, etc.**" | Only the four STAT2 statuses exist. **No intern/employee-type breakdown** | – | NOT IMPLEMENTED (ambiguous; see 3.3) |

### 3.3 Assumptions the owner has NOT yet confirmed (do not treat as facts)

1. **What counts as a hire.** The owner listed `MASSN` for requirement 5 but never said which action codes mean "hire". Implemented as
   `MASSN = '01'` (standard SAP "Hiring"), configurable via `HIRE_MASSN_CODES` (comma list). Re-hires (other codes) are not counted by default.
2. **Which record is "current".** For employees with several infotype rows, the one with the latest `ENDDA`, then latest `BEGDA`. The date
   *today* is not considered (future-dated rows can win).
3. **Employees without a plant/company mapping** are counted under **Unknown** so totals equal the PA0000 headcount (rather than dropping them).
4. **Payroll counting.** All `HRPY_RGDIR` rows count by default. Optionally restrict with `PAYROLL_SRTZA_FILTER` (e.g. `A`). Standard SAP meaning of
   `SRTZA` (A = current result, P = superseded) is not verified against the owner's system.
5. **Hires by country** use the employee's *current* country, not their country at the time of hire.
6. **"Interns, etc."** was interpreted as not part of STAT2; no breakdown by `PERSG`/`PERSK` was built.
7. **"Fetched fresh the first time the application is opened"** was implemented as: the first KPI read after a *server start* (or the frontend
   calling `POST /api/headcount/sync` on load) fetches live from SAP; later reads come from PostgreSQL until a forced refresh.

## 4. Functional requirements (KPI section 2: HCM Core)

### 4.1 Required source data
| Purpose | SAP table | Fields read |
|---|---|---|
| Infotype definitions | `T777D` | `INFTY` |
| Subtypes | `T591A` | `INFTY`, `SUBTY` |
| Infotype texts | `T582S` | `SPRSL`, `INFTY`, `ITEXT` |

### 4.2 Required calculations
| # | Requirement | Implementation | Endpoint | Status |
|---|---|---|---|---|
| 1 | Deduplicate `INFTY` from `T777D`, categorize into 0000–0999 (PA), 1000–1999 (OM), 2000–2999 (TM), 3000–3999 (SAP reserved), 4000–4999 (Recruitment), 5000–5999 (E-Recruiting & Learning), 9000–9999 (Custom). Return count of infotypes per category. | Distinct `INFTY` from `hcm_t777d`; categorized in Node processor; ranges with 0 are preserved with 0 | `GET /api/hcm-core/infotype-categories` | IMPLEMENTED, VERIFIED (mock) |
| 2 | Distinct `(INFTY, SUBTY)` from `T591A`. Count number of subtypes under each infotype. Output: infotype with its count of subtypes (and its functional category). | `GROUP BY infty`, `COUNT(DISTINCT subty)` on `hcm_t591a` where `subty IS NOT NULL` | `GET /api/hcm-core/subtypes-per-infotype` | IMPLEMENTED, VERIFIED (mock) |
| 3 | Deduplicated infotypes from `T777D` with `noOfSubtypes` from `T591A` (0 if none), functional category, and infotype text from `T582S` (filtered for `SPRSL = 'E'`, "NA" if missing). | Left joins from distinct `hcm_t777d` to aggregated subtypes and `hcm_t582s` text (`sprsl = 'E'`) | `GET /api/hcm-core/infotype-detail` | IMPLEMENTED, VERIFIED (mock) |

## 5. Functional requirements (KPI section 3: PA - Personnel Administration)

### 5.1 Required source data
| Purpose | SAP table | Fields read |
|---|---|---|
| Screen definitions | `T582A` | `INFTY`, `EDYNR`, `LDYNR` |
| Module pool mapping | `T777D` | `INFTY`, `REPID` |
| Screen modifications | `T588M` | `REPNA`, `DYNNR`, `ADYNR`, `DBILD` |
| Dynamic actions | `T588Z` | `INFTY`, `SUBTY`, `FNAME`, `OPERA`, `SEQNO`, `KENNZ`, `VINFO` |

### 5.2 Required calculations
| # | Requirement | Implementation | Endpoint | Status |
|---|---|---|---|---|
| 1a | Classify single screen `EDYNR`: 2000 = Universal Standard, 2001–2899 = Country Specific, 2900–2999 = Fast Entry Screens, 0100–0999 or 9000–9999 = Custom, else = Others. | Classified in Node processor; returns total, category summary, and items per infotype | `GET /api/pa/single-screen-classification` | IMPLEMENTED, VERIFIED (mock) |
| 1b | Classify list screen `LDYNR`: 3000 = Universal Standard, 3001–3999 = Country Specific, 0100–0999 or 9000–9999 = Custom, else = Others. | Classified in Node processor; returns total, category summary, and items per infotype | `GET /api/pa/list-screen-classification` | IMPLEMENTED, VERIFIED (mock) |
| 2 | `T588M` module pools `REPNA` where `DYNNR ≠ ADYNR` (excluding blanks, non-deduplicated `REPNA`) mapped to `T777D` (`T588M.REPNA = T777D.REPID`). Returns `infotype` and `modulePool`. | Inner join in SQL; module pools not in `T777D` dropped | `GET /api/pa/module-pool-mapping` | IMPLEMENTED, VERIFIED (mock) |
| 3 | Iterate through each character in `DBILD` string field for all records and tally occurrences of `-` (Hidden), `*` (Display), `+` (Required), `.` (Optional), grouped by `T777D` infotype. | String length difference in SQL, grouped by `INFTY` | `GET /api/pa/field-visibility-summary` | IMPLEMENTED, VERIFIED (mock) |
| 4 | Distinct primary keys `(INFTY, SUBTY, FNAME, OPERA, SEQNO)` from `T588Z` grouped by `INFTY` to get total configured dynamic actions per infotype. | `COUNT(*)` over distinct keys grouped by `INFTY` | `GET /api/pa/dynamic-action-count` | IMPLEMENTED, VERIFIED (mock) |
| 5 | Group records by `(INFTY, SUBTY, FNAME, OPERA)` ordered by `SEQNO`, filter for `KENNZ = 'I'`, extract target infotype from `VINFO` command string (`(?:INS\|COP\|MOD)[,( ]*(\d{4})`), and incorporate any subsequent 'W' lines. | Window function `LEAD` in SQL extracting target infotype and subsequent 'W' default | `GET /api/pa/dynamic-action-triggers` | IMPLEMENTED, VERIFIED (mock) |
| 6 | Group distinct dynamic action logic blocks by `OPERA` code with friendly trigger descriptions. | Distinct `(INFTY, SUBTY, FNAME, OPERA)` grouped by `OPERA` with label mapping | `GET /api/pa/dynamic-action-by-operation` | IMPLEMENTED, VERIFIED (mock) |
| 7 | Filter `KENNZ = 'F'`, extract routine name inside parentheses of `VINFO`, and group by `INFTY` with `COUNT(DISTINCT Routine)` and `COUNT(*)`. | Regex extraction `\(([^)]+)\)` in SQL with distinct routine count and names string | `GET /api/pa/dynamic-action-routines` | IMPLEMENTED, VERIFIED (mock) |

## 6. Main features and capabilities

- Per-KPI-section module structure (routes → controller → service → repository → processor), staging tables per section.
- SAP access via a custom MCP client: HS256 JWT carrying SAP credentials, JSON-RPC `tools/call`, JSON or SSE responses, paging with `rowCount`/`rowSkips`, tolerant row parsing.
- Atomic full-refresh load into PostgreSQL (all tables fetched first, then one transaction).
- Freshness control: first-read sync, shared in-flight fetch, forced refresh, stale fallback with cooldown, sync history in `sync_runs`.
- Database auto-creation and a small migration runner executed at start-up.
- Mock MCP server + synthetic dataset for development and tests without SAP.
- Diagnostic script (`npm run inspect:table`) to see the real `sap_table_read` output.

## 5. Current implementation status (summary)

Fully built and tested against a mock for KPI section 1. **Never run against the real MCP server/SAP by the author.** No frontend, no authentication,
no further KPI sections. Details: [CURRENT_STATUS.md](CURRENT_STATUS.md).

## 6. SAP glossary (as used here)

| Term | Meaning |
|---|---|
| `PERNR` | Personnel number (employee key; 8 digits, zero-padded in SAP) |
| `PA0000` | HR infotype 0000 "Actions": employment status, action type history |
| `PA0001` | HR infotype 0001 "Organizational Assignment": company code, personnel area, groups, payroll area |
| `STAT2` | Employment status in PA0000. Owner's mapping: 0 Withdrawn, 1 Inactive, 2 Retiree, 3 Active |
| `MASSN` | Action type in PA0000 (e.g. 01 = Hiring in standard SAP) |
| `BEGDA` / `ENDDA` | Record start / end date (`YYYYMMDD`; `99991231` = open-ended) |
| `WERKS` | Personnel area in PA0001 |
| `PERSA` | Personnel area, the key of `T500P` (matches PA0001-`WERKS`) |
| `T500P` | Personnel areas table; `LAND1` = country code of the area |
| `LAND1` | Country code (ISO-style 2 letters) |
| `BUKRS` / `BUTXT` | Company code / company name (`T001`) |
| `PERSG` / `PERSK` | Employee group / employee subgroup |
| `ABKRS` | Payroll area |
| `HRPY_RGDIR` | Payroll results directory; one row per payroll result |
| `FPPER` | "For-period" of a payroll result, format `YYYYMM` |
| `SRTZA` | Status of the payroll result record (standard meaning: A current, P old; unverified here) |

## 7. Constraints and preferences stated by the owner

- Backend in **Node.js**; **PostgreSQL** (not MongoDB; see IMPLEMENTATION_HISTORY.md).
- Only these MCP tools were in scope for the first client: `sap_connection_check`, `sap_table_read`, `sap_function_call`, `sap_lock_entries`.
- Data must be fetched fresh when the application is used, but also stored in the database.
- Forget the frontend for now.
- When asked to change something, deliver **only the modified files**, not the whole project.
