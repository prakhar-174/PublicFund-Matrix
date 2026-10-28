# Government Budget Allocation Analyzer (backend)

Django 4.2 + Django REST Framework API for analysing departmental budgets and producing
**decision-support** allocation recommendations. All seeded figures are **fictional**.

## Quick start (Windows PowerShell)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env          # then edit DB_* and SECRET_KEY

# PostgreSQL: create the database named in .env (default budget_db), then:
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo_data --with-users   # prints a demo password once
.\.venv\Scripts\python.exe manage.py runserver
```

No local PostgreSQL? Set `DB_ENGINE=sqlite` in `.env` for a throwaway local database.
Tests: `DB_ENGINE=sqlite` then `python -m pytest` (PowerShell: `$env:DB_ENGINE='sqlite'`).

The frontend dev server origin `http://localhost:5173` is allowed by CORS (`CORS_ALLOWED_ORIGINS`).

## API

| Path | Notes |
|---|---|
| `POST /api/auth/register/` | Public sign-up always creates a **viewer**; only an admin can assign a role |
| `POST /api/auth/login/` | Returns `access`, `refresh`, `user` |
| `POST /api/auth/token/refresh/`, `POST /api/auth/logout/` | Logout blacklists the refresh token |
| `GET/PATCH /api/auth/profile/` | Own profile (role is not editable here) |
| `GET/PATCH /api/auth/users/` | Admin only: change role, department, active flag |
| `/api/departments/`, `/api/fiscal-years/`, `/api/budget-allocations/`, `/api/performance-metrics/` | CRUD with `?search=`, `?ordering=`, `?fiscal_year=`, `?department=`, `?status=` |
| `GET /api/departments/{id}/budget_history/` | Allocations across fiscal years |
| `GET /api/fiscal-years/{id}/summary/` | Total allocated / spent / requested, department count |
| `GET /api/analytics/?report=...` | `year_over_year`, `department_comparison`, `spending_trend`, `underfunded` (no `report` lists them) |
| `POST /api/optimizer/` | `{fiscal_year, total_budget?, max_change_pct?, overrides?, save?}` (analyst/admin). Preview only unless `save: true`, which stores a proposed run |
| `GET /api/optimization-runs/`, `GET /api/optimization-runs/{id}/` | Saved runs with inputs, objective weights and per-department explanations (read-only, any signed-in user) |
| `POST /api/optimization-runs/{id}/decision/` | `{decision: approved\|rejected, comments}`. **Admin only** |
| `GET /api/approvals/` | Decision history (read-only) |
| `GET /api/audit-logs/` | **Admin only**, read-only. Filters: `user`, `action`, `entity_type`, `entity_id`, `since`, `until`, `search` |
| `POST /api/import/budgets/` | Multipart `file` (.csv/.xlsx), optional `dry_run=true` |
| `GET /api/health/` | Unauthenticated; checks the database |

Roles: **admin** (everything, can approve allocations), **analyst** (write budget data, run optimizer, import),
**viewer** (read only). Permissions are enforced in the API, not the UI.

## Optimizer model (`budgets/services/optimizer.py`)

- `need = 0.70 * performance_gap + 0.30 * historical_underfunding`, normalized to shares summing to 1.
  `performance_gap = (100 - score) / 100`; `historical_underfunding` is the mean shortfall of allocation against requests.
- Allocations satisfy `sum = total_budget` exactly (to the paisa) subject to a year-over-year **stability cap**
  (`max_change_pct`, default 25, `null` disables) and any manual **overrides**; solved by a deterministic bisection.
- Infeasible bounds return HTTP 422 with the reason. Constraints are never relaxed silently.
- Missing or outdated data: the median value is used, `data_gaps` is listed, and `confidence` drops.
  Absence of data is never treated as low need.
- Utilization under 70% adds an "investigate causes" flag instead of reducing funding.
- Nothing is written: recommendations never change stored allocations.

**Limitations.** A low performance score raises a department's share (it signals unmet outcomes), but it can equally
reflect inefficiency; the score is not proof of either. Top performers with little historical shortfall can be cut
hard (bounded by the cap), so review results before use. Results are estimates, not guaranteed outcomes.

## Proposed runs and approval

1. An analyst saves a run (`save: true`). It is stored as **proposed**, with its inputs, weights, model version and
   per-department explanations. Stored allocations are not touched.
2. An administrator approves or rejects it. Decisions are final (one per run). Rejection requires a comment.
3. **Approving applies the run** to the stored allocations in one transaction (`allocated_amount`, status `approved`,
   `approved_by`). It is refused with HTTP 409 and the reasons if:
   - any allocation changed since the run was created, or a department gained one (the run is stale; re-run the optimizer),
   - the recommended total exceeds the fiscal year's `total_budget` (when one is set).
4. The creator of a run cannot approve it (they may reject, i.e. withdraw it). Set `REQUIRE_SEPARATE_REVIEWER=False`
   to allow a single administrator to do both, for example on a one-person team.

## Audit log

Create, update and delete on departments, fiscal years, allocations, metrics and users are logged with actor, time, IP
and a field-level before/after diff. So are registration, login, failed login (username only), logout, imports, run
creation and each approval decision. Entries are written in the same transaction as the change, so a failed audit write
rolls the change back. Passwords are never recorded.

Entries are immutable through the ORM, the API (no write endpoints) and the Django admin. This does not stop someone
with direct database access; for that, also revoke UPDATE/DELETE on `audit_auditlog` from the application's database role.

## Assumptions

- `FiscalYear.year` is the starting year: `2025` means FY 2025-26 (April to March).
- Amounts are `Decimal` in the database. Analytics ratios use floats and return `null` where undefined (for example
  utilization of a zero allocation).
- `SpendingEntry` (not in the original model list) holds optional monthly spend for trend charts. The trend report
  states how much of `spent_amount` it covers instead of inventing a monthly split.
- "Underfunded" means `allocated / requested < threshold` (default 0.8).
- Deleting a department or fiscal year that has allocations is blocked (HTTP 409).
- Imports are all-or-nothing, cannot mark rows `approved`, and downgrade an approved row to `revised` when its numbers change.

## Not included in this pass

Frontend, Docker/Compose, scenarios, and report/CSV export endpoints from the earlier broad specification. The backend was verified on SQLite; PostgreSQL is configured but
has not been run against a live server here.
