# Backend Documentation

## 1. Project folder structure

```
sap-kpi-backend/
├── AGENTS.md                        rules for AI agents (read first)
├── README.md                        short run guide
├── package.json / package-lock.json
├── .env.example                     env var template (no secrets); real .env is git-ignored
├── docs/handoff/                    this documentation (+ reference/)
├── mock/
│   ├── mockData.js                  synthetic SAP tables
│   ├── mockMcpServer.js             startMockMcp(): fake Hypercare MCP server
│   └── runMockMcp.js                CLI runner (npm run mock:mcp)
├── scripts/inspect-table.js         prints raw + normalised sap_table_read output
├── src/
│   ├── server.js                    migrate, start listening, graceful shutdown
│   ├── app.js                       createApp(): CORS, JSON, /health, modules, 404, errors
│   ├── config/{env.js, db.js}       env parsing; pg pool + helpers
│   ├── db/{migrate.js, migrations/} migration runner + 001_init.sql, 002_t500p_persa.sql
│   ├── integrations/mcp/            mcpClient.js, sapTools.js, sapTableReader.js
│   ├── modules/
│   │   ├── index.js                 registerModules(app): one line per KPI section
│   │   ├── headcount/               headcount KPI section (see 3.1)
│   │   └── hcm_core/                HCM core infotype metadata KPI section (see 3.2)
│   └── shared/
│       ├── data/countryNames.js     generated: 229 country codes → SAP names
│       ├── db/bulkInsert.js         unnest-based multi-row insert
│       ├── errors/AppError.js       AppError, McpError, ValidationError
│       ├── middleware/errorHandler.js  asyncHandler, notFound, errorHandler
│       ├── sync/                    syncCoordinator.js, syncRuns.repository.js
│       └── utils/                   concurrency.js (mapLimit), countryName.js, sapValues.js
└── tests/                           unit.test.js, headcount.e2e.test.js   (node:test)
```

Size: about 2.3 k lines of JS/SQL including tests and mocks.

## 2. Request pipeline

`Express app` → `cors` → `express.json()` → `/health` or `/api/headcount/*` router → (for KPI reads) `ensureFresh` middleware → `asyncHandler(handler)` → service → repository/processor → `res.json({data, meta})`.
Unmatched → `notFound` (404). Any thrown/rejected error → `errorHandler`.

## 3. Modules and responsibilities

### 3.1 Headcount module (`src/modules/headcount/`)

| File | Responsibility |
|---|---|
| `headcount.constants.js` | `MODULE_NAME="headcount"`; STAT2 labels/order (`3 Active, 1 Inactive, 2 Retiree, 0 Withdrawn`); `getSourceTables()` = SAP table → fields → Postgres columns/types/required |
| `headcount.fetcher.js` | `fetchHeadcountSource()`: reads all 5 SAP tables via `readSapTable` with `mapLimit` concurrency; returns `{pa0000, pa0001, t500p, t001, hrpy_rgdir}` raw records |
| `headcount.loader.js` | `replaceStaging(source)`: one transaction: `TRUNCATE`, convert values (`text`/`date`), skip rows missing required columns, `bulkInsert`; returns row counts per table |
| `headcount.repository.js` | All SQL (see DATABASE_SCHEMA.md section 6) |
| `headcount.processor.js` | Pure shaping: status labels, country names (re-exports `countryName`), summaries with totals/sorting, employee DTO, payroll period parsing, hires structures |
| `headcount.service.js` | `syncHeadcount()` (start run → fetch → load → finish/fail), `coordinator` (SyncCoordinator singleton), `getSyncStatus()`, KPI getters, `getOverview()` |
| `headcount.controller.js` | `ensureFresh` middleware, handlers, query validation (`parseIntParam`), response envelope helper |
| `headcount.routes.js` | Route table for `/api/headcount/*` |

### 3.2 HCM Core module (`src/modules/hcm_core/`)

| File | Responsibility |
|---|---|
| `hcm_core.constants.js` | `MODULE_NAME="hcm_core"`; `INFOTYPE_CATEGORIES` ranges and `categoriseInfotype()`; `getSourceTables()` for T582A, T591A, T582S |
| `hcm_core.fetcher.js` | `fetchHcmCoreSource()`: reads `T582A`, `T591A`, `T582S` via `readSapTable` with `mapLimit` concurrency; returns raw records |
| `hcm_core.loader.js` | `replaceStaging(source)`: one transaction: `TRUNCATE`, convert values (`text`), `bulkInsert` into `hcm_t582a`, `hcm_t591a`, `hcm_t582s` |
| `hcm_core.repository.js` | All SQL for HCM Core: distinct infotypes, subtype counts grouped by infotype, joined infotype/subtype text query |
| `hcm_core.processor.js` | Pure shaping: infotype counts grouped by functional category, subtype counts per infotype with category, flat infotype-subtype detail table |
| `hcm_core.service.js` | `syncHcmCore()`, `coordinator` (SyncCoordinator singleton), `getSyncStatus()`, KPI getters |
| `hcm_core.controller.js` | `ensureFresh` middleware, handlers, response envelope helper |
| `hcm_core.routes.js` | Route table for `/api/hcm-core/*` |

Shared code: `src/shared/sync/syncCoordinator.js` (freshness logic, see SYSTEM_ARCHITECTURE.md section 6), `syncRuns.repository.js` (insert/update/read `sync_runs`, `failInterruptedRuns`),
`src/shared/utils/countryName.js` (SAP list → ICU `Intl.DisplayNames` fallback → raw code; empty → "Unknown"), `sapValues.js` (`cleanText`, `sapDate`, `convertValue`), `concurrency.js` (`mapLimit`),
`src/shared/db/bulkInsert.js`.

**Adding a KPI section** (pattern to follow): create `src/modules/<name>/` with the same eight files; add `NNN_<name>.sql` migration creating `<prefix>_*` staging tables (+ views); register in `src/modules/index.js`;
create a `SyncCoordinator` for it; extend `mock/mockData.js` + e2e tests; update these docs.

## 4. API endpoints

Base path `/api/headcount`. All KPI **GET** responses use the envelope `{ "data": ..., "meta": { "lastSyncedAt": ISO|null, "stale": boolean, "warning"?: string } }`.
Sample payloads below were captured from a live run against the **mock** dataset (not real data).

| Method | Path | Purpose |
|---|---|---|
| POST | `/sync` | Force a sync now (joins an in-flight one). Returns `{data:{runId,status,rowCounts,durationMs,finishedAt}}` (no `meta`). 502 `MCP_ERROR` on SAP failure |
| GET | `/sync/status` | `{data:{syncing, syncedSinceServerStart, lastSuccess, latestRun}}` (run objects: `id,module,status,startedAt,finishedAt,durationMs,rowCounts,error`). No auto-sync |
| GET | `/overview` | `{data:{status, byCountry, byCompanyCode, payroll, hires}}`: all sections except the employee table |
| GET | `/status-summary` | Employees per STAT2 status |
| GET | `/by-country` | Employees per country |
| GET | `/by-company-code` | Employees per company code |
| GET | `/employees` | Paginated employee table |
| GET | `/payroll-by-month` | Distinct employees in payroll per `FPPER` |
| GET | `/hires-per-year` | Hires per year and per year × country |
| GET | `/health` (app level, not under `/api/headcount`) | `{status:"ok"}` after `SELECT 1`; does **not** check SAP/MCP |

Every KPI GET (not `/sync`, `/sync/status`) accepts `?refresh=true` to force a SAP fetch first (failure → error, no stale fallback).

### 4.1 `GET /status-summary`

```json
{ "data": { "total": 12, "items": [
    {"code":"3","label":"Active","employees":8}, {"code":"1","label":"Inactive","employees":2},
    {"code":"2","label":"Retiree","employees":1}, {"code":"0","label":"Withdrawn","employees":1} ] },
  "meta": { "lastSyncedAt": "2026-11-08T18:19:54.981Z", "stale": false } }
```

All four statuses are always present (0 if empty); unexpected codes are appended as `"Unknown (x)"`.

### 4.2 `GET /by-country`

```json
{ "data": { "total": 12, "items": [
    {"countryCode":"IN","country":"India","employees":4}, {"countryCode":"US","country":"USA","employees":3},
    {"countryCode":"DE","country":"Germany","employees":2}, {"countryCode":"GB","country":"United Kingdom","employees":2},
    {"countryCode":null,"country":"Unknown","employees":1} ] }, "meta": {...} }
```

Sorted by employees desc, then name. `country` comes from the SAP country list (`US` → `"USA"`).

### 4.3 `GET /by-company-code`

```json
{ "data": { "total": 12, "items": [
    {"companyCode":"1000","companyName":"Acme US Inc.","label":"1000 - Acme US Inc.","employees":5},
    {"companyCode":null,"companyName":null,"label":"Unknown","employees":1} ] }, "meta": {...} }
```

### 4.4 `GET /employees`

Query: `status` (one of `3,1,2,0`), `country` (ISO code, case-insensitive, or `UNKNOWN`), `companyCode` (or `UNKNOWN`), `search` (PERNR **prefix**), `page` (int ≥ 1, default 1), `pageSize` (1-500, default 50).

```json
{ "data": { "page":1, "pageSize":2, "total":2, "totalPages":1, "items": [
    { "pernr":"00001002", "statusCode":"3", "status":"Active", "countryCode":"IN", "country":"India",
      "companyCode":"2000", "companyName":"Acme India Pvt Ltd", "personnelArea":"2010",
      "employeeGroup":"1", "employeeSubgroup":"DB", "payrollArea":"I1" } ] }, "meta": {...} }
```

### 4.5 `GET /payroll-by-month`

```json
{ "data": { "items": [ {"period":"202401","year":2024,"month":1,"label":"2024-01","employees":4}, ... ] }, "meta": {...} }
```

Only months present in `HRPY_RGDIR` appear (gaps are not filled). Non-`YYYYMM` periods pass through with `year`/`month` null.

### 4.6 `GET /hires-per-year`

```json
{ "data": { "total": 12,
    "byYear":    [ {"year":2015,"hires":1}, {"year":2018,"hires":1}, ... ],
    "byCountry": [ {"year":2015,"countryCode":"GB","country":"United Kingdom","hires":1}, ... ],
    "hireActionCodes": ["01"] }, "meta": {...} }
```

### 4.7 HCM Core endpoints (`/api/hcm-core`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/hcm-core/sync` | Force a sync of T582A, T591A, T582S from SAP now |
| GET | `/api/hcm-core/sync/status` | HCM Core sync status |
| GET | `/api/hcm-core/infotype-categories` | Distinct infotypes from T582A categorized by SAP functional area |
| GET | `/api/hcm-core/subtypes-per-infotype` | Number of distinct subtypes per infotype from T591A |
| GET | `/api/hcm-core/infotype-detail` | Flat table of infotype, subtype, functional category, and English infotype text from T582S |

#### `GET /api/hcm-core/infotype-categories`
Sample response:
```json
{
  "data": {
    "total": 9,
    "items": [
      { "category": "Personnel Administration (PA)", "range": "0000–0999", "infotypeCount": 5 },
      { "category": "Organizational Management (OM)", "range": "1000–1999", "infotypeCount": 2 },
      { "category": "Time Management (TM)", "range": "2000–2999", "infotypeCount": 1 },
      { "category": "SAP Reserved", "range": "3000–3999", "infotypeCount": 0 },
      { "category": "Recruitment", "range": "4000–4999", "infotypeCount": 0 },
      { "category": "E-Recruiting & Learning", "range": "5000–5999", "infotypeCount": 0 },
      { "category": "Custom Infotypes", "range": "9000–9999", "infotypeCount": 1 }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-09T12:00:00.000Z", "stale": false }
}
```

#### `GET /api/hcm-core/subtypes-per-infotype`
Sample response:
```json
{
  "data": {
    "total": 6,
    "totalSubtypes": 10,
    "items": [
      { "infotype": "0000", "category": "Personnel Administration (PA)", "subtypeCount": 1 },
      { "infotype": "0001", "category": "Personnel Administration (PA)", "subtypeCount": 2 },
      { "infotype": "0007", "category": "Personnel Administration (PA)", "subtypeCount": 3 },
      { "infotype": "0008", "category": "Personnel Administration (PA)", "subtypeCount": 1 },
      { "infotype": "1000", "category": "Organizational Management (OM)", "subtypeCount": 2 },
      { "infotype": "9000", "category": "Custom Infotypes", "subtypeCount": 1 }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-09T12:00:00.000Z", "stale": false }
}
```

#### `GET /api/hcm-core/infotype-detail`
Sample response:
```json
{
  "data": {
    "total": 9,
    "items": [
      { "infotype": "0000", "noOfSubtypes": 1, "category": "Personnel Administration (PA)", "infotypeText": "Actions" },
      { "infotype": "0001", "noOfSubtypes": 2, "category": "Personnel Administration (PA)", "infotypeText": "Organizational Assignment" },
      { "infotype": "0002", "noOfSubtypes": 0, "category": "Personnel Administration (PA)", "infotypeText": "Personal Data" },
      { "infotype": "0008", "noOfSubtypes": 1, "category": "Personnel Administration (PA)", "infotypeText": "NA" }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-09T12:00:00.000Z", "stale": false }
}
```

### 4.8 PA endpoints (`/api/pa`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/pa/sync` | Force a sync of T582A, T777D, T588M, T588Z from SAP now |
| GET | `/api/pa/sync/status` | PA sync status |
| GET | `/api/pa/single-screen-classification` | Classification of single screen (`EDYNR`) per infotype from T582A |
| GET | `/api/pa/list-screen-classification` | Classification of list screen (`LDYNR`) per infotype from T582A |
| GET | `/api/pa/module-pool-mapping` | T588M module pools (`REPNA`) where `DYNNR ≠ ADYNR` mapped to T777D `INFTY` |
| GET | `/api/pa/field-visibility-summary` | Summary of hidden (`-`), display (`*`), required (`+`), and optional (`.`) fields per infotype |
| GET | `/api/pa/dynamic-action-count` | Total dynamic actions configured per infotype from T588Z |
| GET | `/api/pa/dynamic-action-triggers` | Logic blocks with KENNZ = 'I' extracting target infotype and subsequent 'W' line defaults |
| GET | `/api/pa/dynamic-action-by-operation` | Distinct dynamic action blocks grouped by OPERA operation code |
| GET | `/api/pa/dynamic-action-routines` | KENNZ = 'F' routines parsed from VINFO with unique routine count, names, and total executions |

#### `GET /api/pa/single-screen-classification`
Sample response:
```json
{
  "data": {
    "total": 7,
    "summary": [
      { "classification": "Universal Standard", "count": 1 },
      { "classification": "Country Specific", "count": 2 },
      { "classification": "Fast Entry Screens", "count": 1 },
      { "classification": "Custom", "count": 2 },
      { "classification": "Others", "count": 1 }
    ],
    "items": [
      { "infotype": "0001", "singleScreen": "2000", "classification": "Universal Standard" },
      { "infotype": "0002", "singleScreen": "2010", "classification": "Country Specific" }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-09T18:00:00.000Z", "stale": false }
}
```

#### `GET /api/pa/module-pool-mapping`
Sample response:
```json
{
  "data": {
    "total": 3,
    "items": [
      { "infotype": "0001", "modulePool": "MP000100" },
      { "infotype": "0002", "modulePool": "MP000200" },
      { "infotype": "0007", "modulePool": "MP000700" }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-09T18:00:00.000Z", "stale": false }
}
```

#### `GET /api/pa/field-visibility-summary`
Sample response:
```json
{
  "data": {
    "total": 3,
    "items": [
      { "infotype": "0001", "hidden": 2, "displayOnly": 2, "required": 2, "optional": 6 },
      { "infotype": "0002", "hidden": 2, "displayOnly": 1, "required": 1, "optional": 0 },
      { "infotype": "0007", "hidden": 1, "displayOnly": 0, "required": 2, "optional": 4 }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-09T18:00:00.000Z", "stale": false }
}
```

#### `GET /api/pa/dynamic-action-count`
Sample response:
```json
{
  "data": {
    "total": 3,
    "totalActions": 8,
    "items": [
      { "infotype": "0001", "dynamicActionSeqCount": 5, "dynamicCount": 3 },
      { "infotype": "0002", "dynamicActionSeqCount": 2, "dynamicCount": 1 },
      { "infotype": "0007", "dynamicActionSeqCount": 1, "dynamicCount": 1 }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-09T18:00:00.000Z", "stale": false }
}
```

#### `GET /api/pa/dynamic-action-triggers`
Sample response:
```json
{
  "data": {
    "total": 2,
    "items": [
      { "infotype": "0001", "targetInfotypes": ["0002"] },
      { "infotype": "0002", "targetInfotypes": ["0007"] }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-09T18:00:00.000Z", "stale": false }
}
```

#### `GET /api/pa/dynamic-action-by-operation`
Sample response:
```json
{
  "data": {
    "total": 5,
    "items": [
      { "operation": "00", "description": "Independent of the current function carried out", "dynamicActionCount": 1, "dynamicActionSeqCount": 2 },
      { "operation": "02", "description": "Change", "dynamicActionCount": 1, "dynamicActionSeqCount": 1 },
      { "operation": "04", "description": "Create", "dynamicActionCount": 1, "dynamicActionSeqCount": 3 },
      { "operation": "06", "description": "Change and create", "dynamicActionCount": 1, "dynamicActionSeqCount": 1 },
      { "operation": "08", "description": "Delete", "dynamicActionCount": 1, "dynamicActionSeqCount": 1 }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-09T18:00:00.000Z", "stale": false }
}
```

#### `GET /api/pa/dynamic-action-routines`
Sample response:
```json
{
  "data": {
    "total": 3,
    "items": [
      {
        "infotype": "0001",
        "uniqueRoutineCount": 2,
        "routineNames": "DATE_CHECK, MASSN_CHECK",
        "uniqueRoutineNames": "DATE_CHECK, MASSN_CHECK",
        "totalDynamicActions": 3,
        "totalExecutions": 3
      }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-09T18:00:00.000Z", "stale": false }
}
```

### 4.9 OM endpoints (`/api/om`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/om/sync` | Force a sync of OM tables (T778O, T778V, T778A, HRP1000, HRP1001, T777P, T77PQ, T77UA) from SAP now |
| GET | `/api/om/sync/status` | OM sync status |
| GET | `/api/om/object-types` | Count of standard (not starting with 9) vs custom (starts with 9) OM object types from T778O |
| GET | `/api/om/relationships` | Count of standard vs custom (starts with Z or 900–999) OM relationships from T778V |
| GET | `/api/om/evaluation-paths` | Count of standard vs custom (starts with Z) OM evaluation paths from T778A |
| GET | `/api/om/objects-per-plan-version` | Count of objects (OTYPE from HRP1000) grouped by plan version (PLVAR) with description (PTEXT from T777P with SPRAS='E') |
| GET | `/api/om/relationships-per-plan-version` | Count of relationships (RELAT from HRP1001) grouped by plan version (PLVAR) with description (PTEXT from T777P with SPRAS='E') |
| GET | `/api/om/auth-profiles` | Count of assigned vs unassigned structural authorization profiles from T77PQ mapped to T77UA |

#### `GET /api/om/object-types`
Sample response:
```json
{
  "data": {
    "stdOmObjects": 3,
    "customOmObjects": 2,
    "total": 5
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:00:00.000Z", "stale": false }
}
```

#### `GET /api/om/relationships`
Sample response:
```json
{
  "data": {
    "stdOmRelationships": 3,
    "customOmRelationships": 2,
    "total": 5
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:00:00.000Z", "stale": false }
}
```

#### `GET /api/om/evaluation-paths`
Sample response:
```json
{
  "data": {
    "stdOmEvaluationPaths": 2,
    "customOmEvaluationPaths": 1,
    "total": 3
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:00:00.000Z", "stale": false }
}
```

#### `GET /api/om/objects-per-plan-version`
Sample response:
```json
{
  "data": {
    "total": 2,
    "items": [
      { "plvar": "01", "ptext": "Current plan", "noOfObjects": 3 },
      { "plvar": "02", "ptext": "Version 02", "noOfObjects": 1 }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:00:00.000Z", "stale": false }
}
```

#### `GET /api/om/relationships-per-plan-version`
Sample response:
```json
{
  "data": {
    "total": 2,
    "items": [
      { "plvar": "01", "ptext": "Current plan", "noOfRelationships": 2 },
      { "plvar": "02", "ptext": "Version 02", "noOfRelationships": 2 }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:00:00.000Z", "stale": false }
}
```

#### `GET /api/om/auth-profiles`
Sample response:
```json
{
  "data": {
    "assignedAuthProfiles": 2,
    "unassignedAuthProfiles": 1,
    "total": 3
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:00:00.000Z", "stale": false }
}
```

### 4.10 KPI section 5: PE (Payroll Engine / Payroll)

Sync control:
- `POST /api/pe/sync` — trigger fetch of all 14 PE tables from SAP now (T549A, T549R, PA0001, T549N, T549B, T549C, T549D, T512W, T500T, PA0008, PA0014, PA0015, PA0267, T512T).
- `GET /api/pe/sync/status` — returns `{ syncing, syncedSinceServerStart, lastSuccess, latestRun }`.

#### `GET /api/pe/payroll-area-summary`
Sample response:
```json
{
  "data": {
    "stdPayrollAreas": 4,
    "customPayrollAreas": 2,
    "total": 6
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

#### `GET /api/pe/period-parameter-summary`
Sample response:
```json
{
  "data": {
    "stdPeriodParameters": 3,
    "customPeriodParameters": 2,
    "total": 5
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

#### `GET /api/pe/employees-per-payroll-area`
Sample response:
```json
{
  "data": {
    "total": 4,
    "items": [
      { "payrollArea": "D1", "noOfEmployees": 2, "employeeCount": 2 },
      { "payrollArea": "G1", "noOfEmployees": 2, "employeeCount": 2 },
      { "payrollArea": "I1", "noOfEmployees": 4, "employeeCount": 4 },
      { "payrollArea": "U1", "noOfEmployees": 5, "employeeCount": 5 }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

#### `GET /api/pe/payroll-areas-per-period`
Sample response:
```json
{
  "data": {
    "total": 4,
    "items": [
      { "permo": "01", "periodParameter": "01", "atext": "Monthly", "periodParameterText": "Monthly", "noOfPayrollAreas": 2 },
      { "permo": "02", "periodParameter": "02", "atext": "Semi-Monthly", "periodParameterText": "Semi-Monthly", "noOfPayrollAreas": 2 },
      { "permo": "50", "periodParameter": "50", "atext": "Bi-Weekly (Custom)", "periodParameterText": "Bi-Weekly (Custom)", "noOfPayrollAreas": 1 },
      { "permo": "51", "periodParameter": "51", "atext": "Special Payroll", "periodParameterText": "Special Payroll", "noOfPayrollAreas": 1 }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

#### `GET /api/pe/company-features-summary`
Sample response:
```json
{
  "data": {
    "stdCompanyFeatures": 3,
    "customCompanyFeatures": 2,
    "total": 5
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

#### `GET /api/pe/feature-functions`
Sample response:
```json
{
  "data": {
    "total": 2,
    "items": [
      { "feature": "NUMKR", "noOfFunctions": 1, "functions": ["NUMGEN"] },
      { "feature": "TARIF", "noOfFunctions": 2, "functions": ["CALC", "CHECK"] }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

#### `GET /api/pe/wage-type-summary`
Sample response:
```json
{
  "data": {
    "stdWageTypes": 3,
    "customWageTypes": 5,
    "total": 8
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

#### `GET /api/pe/wage-types-per-country`
Sample response:
```json
{
  "data": {
    "total": 3,
    "items": [
      { "countryCode": "10", "countryName": "USA", "noOfWageTypes": 4 },
      { "countryCode": "40", "countryName": "India", "noOfWageTypes": 3 },
      { "countryCode": "99", "countryName": "Other Countries", "noOfWageTypes": 1 }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

#### `GET /api/pe/active-wage-types`
Sample response:
```json
{
  "data": {
    "total": 5,
    "items": [
      { "wageType": "/001", "wageTypeText": "Valuation Basis 1" },
      { "wageType": "1000", "wageTypeText": "Basic Salary" },
      { "wageType": "1010", "wageTypeText": "Housing Allowance" },
      { "wageType": "9000", "wageTypeText": "NA" },
      { "wageType": "Z001", "wageTypeText": "Project Bonus" }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

#### `GET /api/pe/payroll-schema-summary`
Sample response:
```json
{
  "data": {
    "stdPayrollSchemas": 3,
    "customPayrollSchemas": 2,
    "total": 5
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

#### `GET /api/pe/payroll-schema-subschemas`
Sample response:
```json
{
  "data": {
    "std": {
      "total": 3,
      "items": [
        { "schema": "XINN", "noOfSubschemas": 1 },
        { "schema": "XMOD", "noOfSubschemas": 2 },
        { "schema": "ZMOD", "noOfSubschemas": 1 }
      ]
    },
    "custom": {
      "total": 2,
      "items": [
        { "schema": "YCU1", "noOfSubschemas": 1 },
        { "schema": "ZCU1", "noOfSubschemas": 2 }
      ]
    }
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

#### `GET /api/pe/pcr-summary`
Sample response:
```json
{
  "data": {
    "stdPcr": 3,
    "customPcr": 3,
    "total": 6
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

#### `GET /api/pe/payroll-functions-operations-summary`
Sample response:
```json
{
  "data": {
    "functions": {
      "stdFunctions": 2,
      "customFunctions": 2,
      "total": 4
    },
    "operations": {
      "stdOperations": 1,
      "customOperations": 1,
      "total": 2
    }
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

#### `GET /api/pe/custom-functions-operations`
Sample response:
```json
{
  "data": {
    "total": 3,
    "items": [
      { "type": "Function", "name": "YCALC", "description": "Custom Function Y" },
      { "type": "Function", "name": "ZTEST", "description": "Custom Function Z" },
      { "type": "Operation", "name": "ZOPER", "description": "Custom Operation Z" }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

#### `GET /api/pe/unused-payroll-areas`
Sample response:
```json
{
  "data": {
    "total": 1,
    "items": [
      { "payrollArea": "X1", "endDate": "2023-12-31" }
    ]
  },
  "meta": { "lastSyncedAt": "2026-11-10T12:30:00.000Z", "stale": false }
}
```

### 4.11 Errors

`{ "error": { "code": "<CODE>", "message": "...", "details"?: ... } }`

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | bad `page`/`pageSize`/`status` (e.g. `status must be one of 3, 1, 2, 0`) |
| 404 | `NOT_FOUND` | unknown route (`No route for GET /api/nope`) |
| 502 | `MCP_ERROR` | SAP/MCP failure during a sync that cannot fall back to stale data (forced sync, or first sync with no earlier success) |
| 500 | `INTERNAL_ERROR` | anything else (details are logged, not returned) |

## 5. Middleware

`cors` (origin `true` when `CORS_ORIGIN=*`, else the comma-separated list), `express.json()`, `ensureFresh` (module-level, described above), `notFound`, `errorHandler`, helper `asyncHandler`.
Not implemented: authentication, authorization, rate limiting, request logging/IDs, helmet/security headers, compression.

## 6. Validation and error handling

Manual validation only (no schema library): `parseIntParam` for `page`/`pageSize`, whitelist check for `status`; `country` upper-cased; strings trimmed. SQL uses bound parameters only.
Errors are classes: `AppError(message,{status,code,details})`, `McpError` (502), `ValidationError` (400). 5xx errors are logged with `console.error`. Startup failures print `[server] failed to start: ...` and exit 1.
Sync failures: transaction rollback, `sync_runs.status='failed'` with message, error rethrown.

## 7. Environment variables (names and purposes; never commit values)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 4000 | HTTP port |
| `CORS_ORIGIN` | `*` | Allowed origin(s), comma-separated |
| `NODE_ENV` | development | Read into config but **not used** anywhere |
| `DATABASE_URL` | none | Postgres URL; if set, takes precedence over `PG*` |
| `PGHOST` `PGPORT` `PGUSER` `PGPASSWORD` `PGDATABASE` | localhost / 5432 / postgres / (empty) / hr_kpi | Postgres connection when no `DATABASE_URL` |
| `PGSSL` | false | `true` enables TLS (no cert verification) |
| `PG_ADMIN_DATABASE` | postgres | Maintenance DB used to create the target DB |
| `MCP_URL` | `https://localhost:8000/hypercare-mcp` | MCP endpoint |
| `MCP_JWT_SECRET` | placeholder | HS256 signing secret shared with the MCP server |
| `MCP_TOKEN_TTL_SECONDS` | 3600 | JWT lifetime (token renewed 60 s before expiry) |
| `MCP_TIMEOUT_MS` | 180000 | Per-request timeout |
| `SAP_ASHOST` `SAP_SYSNR` `SAP_CLIENT` `SAP_USER` `SAP_PASSWD` `SAP_LANG` | placeholders / 00 / 100 / EN | SAP logon data placed in the JWT `sap` claim |
| `SAP_HTTP_BASE_URL` `SAP_HTTP_CLIENT` `SAP_HTTP_USER` `SAP_HTTP_PASSWD` | none | Optional HTTP channel block in the JWT (only if `SAP_HTTP_BASE_URL` set; others default to the RFC values) |
| `SAP_PAGE_SIZE` | 5000 | Rows per `sap_table_read` call |
| `SAP_MAX_PAGES` | 2000 | Safety limit of pages per table |
| `SAP_FETCH_CONCURRENCY` | 2 | Tables read in parallel |
| `SYNC_RETRY_COOLDOWN_MS` | 60000 | After a failed auto-refresh, wait before trying SAP again (serve stale meanwhile) |
| `HIRE_MASSN_CODES` | `01` | Comma list of `PA0000-MASSN` codes counted as hires |
| `PAYROLL_SRTZA_FILTER` | empty | Comma list of `HRPY_RGDIR-SRTZA` values to count (empty = all) |
| `TEST_DATABASE_URL` | local `hr_kpi_test` (hard-coded dev default in the test file) | Database the e2e test **wipes** |
| `MOCK_PORT` | 8000 | Port of `npm run mock:mcp` |

`.env` is loaded by `dotenv/config` (does not override variables already in the process environment). Removed: `T500P_WERKS_FIELD` (obsolete since the PERSA correction; harmless if still present in a `.env`).

## 8. Dependencies and why

| Package | Version (installed) | Why |
|---|---|---|
| `express` | ^4.21 (4.22.3) | HTTP server/routing. v4 chosen over v5 for stability; async errors handled by `asyncHandler` |
| `pg` | ^8.13 (8.23.1) | PostgreSQL driver; pool, parameterised queries, transactions |
| `dotenv` | ^16.4 (16.6.1) | Load `.env` |
| `cors` | ^2.8 (2.8.6) | CORS for a future browser frontend |

Everything else is built in: `fetch`, `crypto` (JWT), `node:test` + `node:assert` (tests), `node:http` (mock), `Intl.DisplayNames` (country-name fallback). Deliberately **not** used: ORM/query builder, JWT library, MCP SDK, validation library, logger, TypeScript.
Dev tooling: none (no ESLint/Prettier/CI/Docker). `npm run dev` uses `node --watch`.

## 9. Tests

`npm test` = `node --test --test-concurrency=1` (runs both files). 12 e2e tests (real PostgreSQL + in-process mock MCP + the real Express app on a random port) and 8 unit tests (date parsing, response normalisation shapes and failures, status summary, country names, country-list integrity, payroll formatting, SyncCoordinator).
The e2e test header lists the hand-computed expected values for the mock dataset. Covered: first-read live sync with paging and SSE, no SAP calls on later reads, every KPI endpoint, filters/pagination/validation, forced sync, SAP-down behaviour (502 + previous data intact + `sync_runs` states), `/health`, 404.
