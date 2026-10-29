# project\_context.md — Government Budget Allocation Analyzer

Oct 27, 2026 · @Prakhar

## Project overview

The Government Budget Allocation Analyzer is a full-stack web application that ingests departmental budget data, tracks historical allocations and actual spending, scores each department on performance metrics, and produces data-driven reallocation recommendations. The primary users are budget analysts and finance administrators inside a government body.

**Core capabilities:**

- Visualize budget allocation across departments with interactive charts
- Compare current vs. historical budgets year-over-year
- Score departments on performance relative to spend
- Generate optimized reallocation suggestions using a weighted scoring engine
- Import budget data from CSV/Excel; export reports
- Role-based access: Admin, Analyst, Viewer

**Design philosophy:** Clean, professional, data-first UI. No decorative color. Every visual element earns its place by aiding comprehension of financial data.

## Repository structure

Monorepo with two top-level workspaces: `backend/` (Django) and `frontend/` (React + Vite). The AI agent should always confirm which workspace it is operating in before writing files.

```
budget-analyzer/
├── backend/                    # Django project root
│   ├── budget_api/             # Django project config (settings, urls, wsgi, asgi)
│   ├── users/                  # App: custom user model, JWT auth endpoints
│   ├── budgets/                # App: departments, allocations, fiscal years
│   │   └── services/
│   │       ├── analytics.py    # Pandas analytics service
│   │       └── optimizer.py    # NumPy optimization engine
│   ├── core/                   # Shared utilities, base serializers, permissions
│   ├── requirements.txt
│   ├── .env                    # Never committed; .env.example is committed
│   └── manage.py
│
├── frontend/                   # React + Vite project root (pre-configured by user)
│   ├── src/
│   │   ├── api/                # TanStack Query hooks + Axios instance
│   │   ├── components/         # Reusable UI components (shadcn/ui + custom)
│   │   │   ├── charts/         # Recharts wrappers
│   │   │   └── ui/             # shadcn components (auto-generated)
│   │   ├── pages/              # Route-level page components
│   │   │   ├── Dashboard/
│   │   │   ├── Budgets/
│   │   │   ├── Analytics/
│   │   │   ├── Optimizer/
│   │   │   └── Admin/
│   │   ├── lib/                # Utility functions, formatters, constants
│   │   ├── store/              # Global state (auth context)
│   │   ├── types/              # TypeScript-style JSDoc type definitions
│   │   └── main.jsx
│   ├── public/
│   ├── index.html
│   └── vite.config.js
│
├── docker-compose.yml          # PostgreSQL + Django + Vite dev services
└── README.md
```

## Tech stack

### Frontend

| Library | Version | Role |
| --- | --- | --- |
| React | 18.x | UI framework |
| Vite | 5.x | Build tool + dev server |
| JavaScript (ES2022) | — | Language |
| Tailwind CSS | 3.x | Utility-first styling |
| shadcn/ui | latest | Accessible component primitives |
| Recharts | 2.x | Chart library |
| React Router | 6.x | Client-side routing |
| TanStack Query | 5.x | Server state, caching, background refetch |
| React Hook Form | 7.x | Form state management |
| Zod | 3.x | Schema-based form validation |
| Framer Motion | 11.x | Page transitions, card animations, number counters |
| Lucide React | latest | Icon library (stroke-style, consistent weight) |
| Axios | 1.x | HTTP client (wrapped in `src/api/`) |

### Backend

| Library | Version | Role |
| --- | --- | --- |
| Python | 3.11+ | Language |
| Django | 4.2 LTS | Web framework |
| Django REST Framework | 3.15.x | API layer |
| djangorestframework-simplejwt | 5.x | JWT authentication |
| django-cors-headers | 4.x | CORS for Vite dev server |
| django-filter | 23.x | Query param filtering on viewsets |
| Pandas | 2.x | Tabular data processing and analytics |
| NumPy | 1.26.x | Numerical optimization in budget engine |
| psycopg2-binary | 2.9.x | PostgreSQL adapter |
| python-decouple | 3.x | Environment variable management |
| openpyxl | 3.x | Excel file parsing for data import |

### Infrastructure

| Service | Notes |
| --- | --- |
| PostgreSQL 15 | Primary database |
| Docker Compose | Local dev orchestration (db + backend + frontend) |

## Architecture overview

The frontend communicates exclusively with the Django REST API over HTTP/JSON. All API calls are routed through a centralized Axios instance (`src/api/client.js`) that attaches the JWT access token from localStorage to every request header and handles 401 responses by attempting a silent token refresh before retrying.

TanStack Query wraps every API call. Query keys are namespaced by resource (`['budgets', fiscalYearId]`, `['analytics', 'comparison', fiscalYearId]`). Cache TTL is 5 minutes for reference data (departments, fiscal years) and 30 seconds for live analytics. Mutations always invalidate their parent query on success.

React Router v6 defines four protected route groups — Dashboard, Budgets, Analytics, Optimizer — plus an Admin group gated to the `admin` role. A root `<AuthGuard>` component reads the auth context and redirects unauthenticated users to `/login`.

Django serves the REST API only. The React build (static files) is served separately by Vite in development and by a CDN or Nginx in production. CORS is restricted to the frontend's origin.

## Data models

### users app

| Model | Key fields |
| --- | --- |
| `User` | `id`, `username`, `email`, `role` (admin/analyst/viewer), `department` FK nullable |

### budgets app

| Model | Key fields |
| --- | --- |
| `Department` | `id`, `name`, `code`, `description`, `head_name`, `created_at` |
| `FiscalYear` | `id`, `year` (int), `is_active` (bool), `total_budget` (Decimal) |
| `BudgetAllocation` | `id`, `department` FK, `fiscal_year` FK, `allocated_amount`, `spent_amount`, `requested_amount`, `approved_by` FK→User, `status` (draft/approved/revised) |
| `PerformanceMetric` | `id`, `department` FK, `fiscal_year` FK, `metric_name`, `metric_value` (float), `weight` (float), `description` |

## API reference

Base URL: `http://localhost:8000/api/`  All protected routes require `Authorization: Bearer <access_token>`.

### Auth — `/api/auth/`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register/` | None | Create account |
| POST | `/auth/login/` | None | Returns `access` + `refresh` tokens |
| POST | `/auth/logout/` | Yes | Blacklists refresh token |
| POST | `/auth/token/refresh/` | None | Returns new access token |
| GET | `/auth/profile/` | Yes | Current user info |

### Departments — `/api/departments/`

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/departments/` | List all |
| POST | `/departments/` | Create (Admin) |
| GET/PUT/DELETE | `/departments/{id}/` | CRUD |
| GET | `/departments/{id}/budget_history/` | All allocations across fiscal years |

### Fiscal Years — `/api/fiscal-years/`

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/fiscal-years/` | List all |
| POST | `/fiscal-years/` | Create (Admin) |
| GET | `/fiscal-years/{id}/summary/` | Total allocated, spent, dept count |

### Budget Allocations — `/api/allocations/`

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/allocations/` | List; filter by `?fiscal_year=&department=&status=` |
| POST | `/allocations/` | Create |
| GET/PUT/DELETE | `/allocations/{id}/` | CRUD |

### Performance Metrics — `/api/metrics/`

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/metrics/` | List; filter by `?fiscal_year=&department=` |
| POST | `/metrics/` | Create |
| GET/PUT/DELETE | `/metrics/{id}/` | CRUD |

### Analytics — `/api/analytics/`

| Method | Endpoint | Returns |
| --- | --- | --- |
| GET | `/analytics/yoy/?department_id=` | Year-over-year allocation vs. spend |
| GET | `/analytics/comparison/?fiscal_year_id=` | All depts ranked by utilization + performance |
| GET | `/analytics/trend/?fiscal_year_id=` | Spending progression over time |
| GET | `/analytics/underfunded/?fiscal_year_id=` | Depts where requested/allocated > threshold |

### Optimizer — `/api/optimizer/`

| Method | Endpoint | Body | Returns |
| --- | --- | --- | --- |
| POST | `/optimizer/recommend/` | `{fiscal_year_id, total_budget}` | Ranked recommendation list |
| POST | `/optimizer/scenario/` | `{fiscal_year_id, overrides: {}}` | Scenario result with redistributed remainder |

### Import & Health

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/import/budgets/` | CSV/Excel upload; multipart form |
| GET | `/health/` | `{status: ok}` |

**Filter params on list endpoints:** `ordering=allocated_amount`, `ordering=-spent_amount`

## Frontend module map

### Pages and their API dependencies

| Page | Route | Primary API calls | Key components |
| --- | --- | --- | --- |
| Login | `/login` | `POST /auth/login/` | `LoginForm`, JWT storage, redirect |
| Dashboard | `/` | `GET /fiscal-years/{id}/summary/`, `/analytics/comparison/`, `/allocations/` | `KPICard`, `AllocationTreemap`, `SpendingAreaChart`, `TopDeptTable` |
| Budgets — List | `/budgets` | `GET /allocations/`, `/departments/`, `/fiscal-years/` | `BudgetTable`, `FiscalYearSelector`, `StatusBadge` |
| Budgets — Detail | `/budgets/:deptId` | `GET /departments/:id/budget_history/`, `/analytics/yoy/` | `YoYBarChart`, `AllocationForm`, `MetricsTable` |
| Analytics | `/analytics` | `GET /analytics/comparison/`, `/analytics/trend/`, `/analytics/underfunded/` | `PerformanceScatterPlot`, `SpendTrendChart`, `UnderfundedAlert` |
| Optimizer | `/optimizer` | `POST /optimizer/recommend/`, `/optimizer/scenario/` | `RecommendationList`, `ScenarioSliders`, `ImpactBarChart` |
| Admin — Users | `/admin/users` | `GET/POST /auth/register/`, `/auth/profile/` | `UserTable`, `RoleBadge`, `InviteModal` |
| Admin — Import | `/admin/import` | `POST /import/budgets/` | `FileDropzone`, `ImportPreview`, `ProgressBar` |

### Shared components

- `AppShell` — sidebar nav + topbar, wraps all protected pages
- `AuthGuard` — redirects unauthenticated users, checks role for admin routes
- `FiscalYearContext` — global active fiscal year, consumed by all pages
- `PageHeader` — title + breadcrumb + action slot
- `DataTable` — sortable, filterable table built on shadcn/ui + TanStack Table
- `StatCard` — KPI card with value, label, trend delta, and Framer Motion counter
- `EmptyState` — consistent zero-state with icon and CTA
- `ErrorBoundary` — catches and displays API errors gracefully
- `ConfirmDialog` — shadcn AlertDialog wrapper for destructive actions

## Design system

### Color tokens (Tailwind config extension)

| Token | Hex | Usage |
| --- | --- | --- |
| `primary-950` | `#0F172A` | Page background (dark base) |
| `primary-900` | `#1E293B` | Card / panel surface |
| `primary-800` | `#334155` | Subtle borders, dividers |
| `primary-400` | `#94A3B8` | Muted text, labels |
| `primary-50` | `#F8FAFC` | Light mode page background |
| `accent-blue` | `#3B82F6` | Primary actions, links, active nav |
| `accent-emerald` | `#10B981` | Positive delta, on-target spend |
| `accent-amber` | `#F59E0B` | Warning, approaching limit |
| `accent-red` | `#EF4444` | Deficit, over-budget, error states |

All chart series use only the four accent colors plus `#8B5CF6` (violet) as a fifth series color. Never use decorative gradients on data elements.

### Typography

- **Font:** Inter (Google Fonts, already Tailwind default)
- **Numeric figures:** All currency and percentage values use `font-variant-numeric: tabular-nums` so columns align. Apply via `font-mono` or a custom `tabular-nums` utility class.
- **Scale:** `text-xs` (11px) for chart axis labels; `text-sm` for table cells; `text-base` for body; `text-2xl font-semibold` for KPI values; `text-3xl font-bold` for page titles.

### Animation — Framer Motion

| Interaction | Animation |
| --- | --- |
| Page transition | `opacity 0→1`, `y 12px→0`, `duration 0.25s ease-out` |
| Card entrance | `opacity 0→1`, `y 16px→0`, stagger `0.06s` per card |
| KPI number counter | `useMotionValue` + `useTransform`, 800ms spring |
| Sidebar expand/collapse | `width` spring, `stiffness 260, damping 24` |
| Chart tooltip appear | Recharts built-in, `animationDuration={300}` |

Avoid motion on elements the user is actively reading (tables, text blocks). Motion is for orientation — showing where something came from, not decoration.

### Icons — Lucide React

Named imports only: `import { LayoutDashboard, TrendingUp, PieChart, Sliders, ShieldCheck, Upload, Bell, ChevronDown } from 'lucide-react'`. Size `16` for inline/table use, `20` for nav items, `24` for page headers. Never use emoji as icons.

### Component conventions

- All shadcn/ui components live in `src/components/ui/` (auto-generated via CLI, never hand-edited)
- Custom components that wrap shadcn go in `src/components/` with a descriptive name
- Chart wrappers in `src/components/charts/` accept raw API response shapes and handle their own loading/empty states internally
- `cn()` utility (clsx + tailwind-merge) for all conditional className logic

## Development phases

| Phase | Scope | Key deliverable |
| --- | --- | --- |
| 1 | Vite config, Tailwind, shadcn/ui, Framer Motion, Axios client, TanStack Query setup | Runnable shell with design tokens wired |
| 2 | Auth: Login page, JWT storage, AuthGuard, token refresh interceptor | Protected routing works end-to-end |
| 3 | AppShell: sidebar nav, topbar, FiscalYearContext, responsive layout | All pages render inside the shell |
| 4 | Dashboard page: KPI cards, Treemap, AreaChart, top-dept table | Core visual impression of the app |
| 5 | Budgets module: list table, fiscal year filter, status badges, detail page + YoY bar chart | Budget data fully browsable |
| 6 | Analytics page: scatter plot, spend trend chart, underfunded alerts | Analytical views complete |
| 7 | Optimizer page: recommendation cards, scenario sliders, impact chart | Optimization UX complete |
| 8 | Admin module: user management table, CSV/Excel import with dropzone | Admin capabilities complete |
| 9 | Polish: loading skeletons, error boundaries, empty states, Framer Motion page transitions, responsive audit | Production-quality UX |

## Conventions & rules

### Naming

- Files: `PascalCase` for components (`BudgetTable.jsx`), `camelCase` for hooks (`useBudgets.js`) and utilities (`formatCurrency.js`)
- CSS classes: Tailwind utilities only — no custom CSS files except `index.css` for base resets and the `tabular-nums` utility
- API query keys: array form, always `['resource', ...params]` — e.g. `['allocations', { fiscal_year: id }]`
- Environment variables: prefix `VITE_` for all frontend env vars; `VITE_API_BASE_URL=http://localhost:8000/api`

### Code conventions

- No TypeScript — use JSDoc `@param` and `@returns` on all exported functions for IDE type hints
- All API calls live in `src/api/` as named async functions; pages never call `axios` directly
- TanStack Query hooks (`useQuery`, `useMutation`) live in `src/api/hooks/` — one file per resource
- Zod schemas in `src/lib/schemas.js` — imported by React Hook Form via `zodResolver`
- Currency values always formatted with `Intl.NumberFormat` — never raw `.toLocaleString()`

### Commit style

Conventional Commits: `feat:`, `fix:`, `chore:`, `style:`, `refactor:`. Scope optional but encouraged — e.g. `feat(dashboard): add allocation treemap`.

### Testing approach

- Unit tests: Vitest for utility functions and Zod schemas
- Component tests: React Testing Library for form validation flows
- API integration: test against seeded backend (`python manage.py seed_demo_data`) in a local `.env.test`

### Environment variables

| Variable | Example value | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8000/api` | No trailing slash |
| `VITE_TOKEN_KEY` | `budget_access` | localStorage key for access token |
| `VITE_REFRESH_KEY` | `budget_refresh` | localStorage key for refresh token |
