# Truetime Attendance Platform

This repository contains the technical specification and implementation plan for **Truetime**, an attendance management web application inspired by the look-and-feel of [ksipl.paydayonline.in](https://ksipl.paydayonline.in/). The goal is to ingest biometric logs from eSSL devices, process them into actionable attendance insights, and present them through a modern, responsive UI.

## Product Goals
- **Reliable biometric ingestion** – Automatically poll eSSL devices, normalize the raw punches, and maintain a complete audit trail.
- **Actionable insights** – Offer dashboards, exception management, and rich reporting for HR teams and supervisors.
- **Delightful UI** – Deliver a polished experience similar to the reference site, optimized for both desktop and tablet usage.

## System Architecture

```
+----------------+       +---------------------+       +-------------------------+
|  eSSL Devices  | --->  | Ingestion Service   | --->  | Core API & Processing   |
+----------------+       +---------------------+       +-------------------------+
                                                              |
                                                              v
                                                       +--------------+
                                                       | PostgreSQL   |
                                                       +--------------+
                                                              |
                                                              v
                                                       +----------------+
                                                       | React Frontend |
                                                       +----------------+
```

### 1. Device Ingestion Service
- Poll devices via the eSSL/ZKTeco SDK over TCP/IP (default port `4370`).
- Cache the `last_log_id` per device to avoid duplicates and persist `external_id` alongside every punch.
- Retry on transient failures, surface device heartbeat metadata (`last_sync_at`, `last_seen_at`) and alert on repeated failures.
- Persist raw logs to the `biometric_logs` table for auditing.

### 2. Core API & Processing Layer
- Built with **FastAPI** for typed, async-friendly endpoints that integrate cleanly with the eSSL worker.
- Implements attendance processing pipelines (shift resolution, tardiness, overtime).
- Exposes REST + WebSocket endpoints for near real-time log updates.
- Handles authentication (JWT) and role-based authorization (RBAC).

### 3. Database Schema (PostgreSQL)
- `employees`: demographic data, employment status, shift assignment.
- `biometric_devices`: model, firmware, network info, heartbeat timestamps.
- `biometric_logs`: immutable raw punches from devices.
- `attendance_entries`: processed daily roll-ups per employee.
- `shifts`: configurable working hours, grace periods, overtime rules.
- `users`, `roles`, `permissions`: for application access control.

### 4. Frontend Application
- Built with **React + Vite** for fast iteration.
- Uses **Tailwind CSS** and **Headless UI** to recreate the modern, glassmorphism-inspired aesthetic of the reference site.
- State management with **React Query** for caching API data and background refresh.
- Routing handled by **React Router v6** with protected routes based on RBAC.

## Feature Breakdown

### Dashboards
- Executive metrics (attendance %, late arrivals, overtime hours) surfaced through cards and charts.
- Device health widget highlighting offline or error states.

### Attendance Monitoring
- Real-time feed of punches with search by employee, device, or date range.
- Inline anomaly tagging (missing punch, duplicate, manual correction requested).

### Shift & Policy Management
- CRUD for shifts, grace periods, auto-approval rules for overtime/undertime.
- Bulk assignment of shifts to departments.

### Employee Self-Service
- Personal attendance calendar with status color coding.
- Request corrections or manual punches subject to supervisor approval.

### Reports & Exports
- Downloadable CSV/PDF for daily, weekly, and monthly summaries.
- Scheduled email reports to stakeholders.

## UI Design Direction
- **Layout:** Sidebar navigation with collapsible sections, topbar for search/profile, content cards with subtle shadows.
- **Palette:** Neutral background (#f5f6fa) with primary accents (#2c7be5) and semantic colors for status chips.
- **Components:**
  - Attendance feed table with sticky headers, pill-shaped status badges.
  - KPI cards with iconography and animated count-up.
  - Modal dialogs for manual corrections and shift assignment.
- **Accessibility:** WCAG AA contrast, keyboard navigation, descriptive ARIA labels.

## Development Roadmap
1. **Foundation** – Scaffold backend (FastAPI) and frontend (Vite + React), configure shared TypeScript models. ✅
2. **Device Integration** – Implement eSSL polling workers, store raw logs, expose health endpoints. ✅
3. **Processing Engine** – Build attendance calculation jobs, exception workflows, notifications.
4. **UI Iteration** – Create dashboard, attendance feed, employee profiles, shift management pages. ✅
5. **Reports & Automation** – Scheduled reports, exports, and third-party integrations.
6. **QA & Deployment** – Automated tests, containerization, CI/CD pipelines, staging rollout.

## Testing Strategy
- **Backend:** Pytest-based unit and integration tests with SQLite for fast feedback and PostgreSQL compatibility in CI.
- **Frontend:** React Testing Library for components, Cypress for end-to-end scenarios.
- **Performance:** Load testing ingestion endpoints using k6 to validate throughput.

## Deployment Considerations
- Docker Compose for local development (API, database, worker, frontend).
- Production deployment on AWS (ECS/Fargate or EKS) with RDS for PostgreSQL and CloudFront for static assets.
- Centralized logging via CloudWatch or ELK, monitoring with Prometheus + Grafana.
- Continuous Integration via GitHub Actions (`.github/workflows/ci.yml`) running backend tests and frontend production builds on every push/PR.

---

This plan provides the blueprint to start implementing Truetime, ensuring seamless eSSL biometric integration and a high-quality user experience reminiscent of the reference application.


## Getting Started with the Prototype API

The repository now includes an initial FastAPI implementation under `backend/` to start experimenting with device ingestion and attendance workflows.

### Prerequisites
- Python 3.11+
- `virtualenv` or `pyenv` (recommended)
- A running PostgreSQL 14+ instance (local Docker, managed service, etc.)

### Installation
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # configure DB + secrets
```

Update `.env` with at least the following values:

```
TRUETIME_DATABASE_URL=postgresql+asyncpg://<user>:<password>@localhost:5432/truetime
TRUETIME_SECRET_KEY=<generate-a-strong-random-string>
TRUETIME_AUTO_RUN_MIGRATIONS=true
```

### Running the API

Run the database migrations once:

```bash
alembic upgrade head
```

Then start the API:

```bash
uvicorn app.main:app --reload
```

If `TRUETIME_AUTO_RUN_MIGRATIONS=true` is set the application will execute `alembic upgrade head` automatically on startup. Visit [http://localhost:8000/docs](http://localhost:8000/docs) to explore the interactive OpenAPI documentation.

### Available Endpoints
All endpoints (except the token endpoint) require a Bearer token issued by `POST /api/auth/token`.

- `POST /api/auth/token` – exchange email/password credentials for a JWT access token.
- `GET /api/users/me` – fetch the authenticated user’s profile.
- `POST /api/users` – create a new user (admin/manager only).
- `GET /api/users` – list users (admin only).
- `POST /api/employees` – register an employee with a unique code (manager/admin).
- `POST /api/devices` – register an eSSL biometric terminal (manager/admin).
- `POST /api/attendance/logs` – record a raw punch captured from a biometric device (manager/admin).
- `GET /api/attendance/logs` – list captured punches with optional filters and pagination.
- `GET /api/dashboard` – deliver aggregated KPIs and a recent log feed for the web dashboard.
- `POST /api/shifts` – configure working hours and grace periods for each shift template (manager/admin).
- `GET /api/shifts` – list all configured shifts to power the planner UI.
- `POST /api/employees/{code}/shift` – assign a shift to an employee effective from a specific date (manager/admin).
- `GET /api/attendance/summaries` – compute daily attendance outcomes (present/late/absent) with total worked minutes.
- `POST /api/devices/{serial}/sync` – trigger an on-demand sync cycle against a single biometric terminal (manager/admin).

### Authentication & RBAC

1. Use the CLI helper to create your first administrative user:

   ```bash
   python -m app.cli create-user --email admin@example.com --full-name "Admin" --role admin
   ```

2. Request an access token with those credentials:

   ```bash
   curl -X POST http://localhost:8000/api/auth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "username=admin@example.com&password=<password>"
   ```

3. Pass the returned token as `Authorization: Bearer <token>` to every other API call.

### Device Ingestion Runtime

The ingestion worker connects directly to eSSL/ZKTeco terminals using the [`zk`](https://pypi.org/project/zk/) Python package.

| Setting | Environment variable | Default | Description |
| --- | --- | --- | --- |
| Enable background worker | `TRUETIME_INGESTION_ENABLED` | `false` | When `true`, the API launches a background task that polls every registered device. |
| Polling interval | `TRUETIME_INGESTION_POLL_INTERVAL_SECONDS` | `60` | Seconds between sync cycles. |
| Connection timeout | `TRUETIME_INGESTION_CONNECTION_TIMEOUT` | `10` | Socket timeout passed to the SDK. |
| Force UDP transport | `TRUETIME_INGESTION_FORCE_UDP` | `false` | Set to `true` when devices require UDP communication. |

Each device stores its network configuration (`ip_address`, `port`, optional `comm_key`) plus metadata about the last successful sync. Manual syncs are exposed via the API and the React UI.

## Frontend (React + Vite)

The `frontend/` folder hosts a Vite-powered React UI that mirrors the styling and IA of the reference site. It consumes the API endpoints above via React Query and Axios and now includes an authentication gate + session handling that persists the issued JWT.

### Installation

```bash
cd frontend
npm install
```

### Development server

```bash
npm run dev
```

By default the UI expects the API to run at `http://localhost:8000/api`. For production deployments (for example, hosting the SPA on Vercel), set a `VITE_API_BASE_URL` environment variable that points at your publicly accessible FastAPI instance. When this variable is not provided the UI automatically targets `https://<your-domain>/api`, which allows you to use Vercel rewrites or a reverse proxy to forward `/api` requests to the backend service.

#### Deploying the SPA on Vercel

The repository now includes a `vercel.json` that pins the install/build commands to the `frontend/` workspace and exposes `frontend/dist` as the output directory. That means you can deploy without touching the project settings in the Vercel UI:

1. **Create the project** – Point Vercel at this repo and keep the default root directory. Vercel will execute the scripted install/build steps from `vercel.json`, which handle installing dependencies and running `vite build` inside `frontend/`.
2. **Expose the API URL** – In the Vercel dashboard add `VITE_API_BASE_URL=https://<your-backend-domain>/api` (or configure a rewrite in the dashboard that forwards `/api/*` to your backend).
3. **Redeploy** – Trigger a deploy. The generated static assets are served directly from `frontend/dist`, matching the paths the SPA expects.

These defaults align with the local build command (`npm run build`) and the CI workflow so you get identical production artifacts.

After signing in, the main screens available are:

- **Dashboard** – KPI cards, recent punch feed, and device health summary driven by live device heartbeats.
- **Attendance Logs** – filterable, paginated punch explorer with device log IDs.
- **Daily Summary** – review present/late/absent status, totals, and lateness for any date.
- **Shift Planner** – create shift templates and assign them to employees.
- **Workforce Directory** – manage employees, biometric devices, and run on-demand device syncs.

### Running Tests
```bash
cd backend
pytest
```

### Next Steps
- Expand the processing engine with exception workflows (missed punches, approvals).
- Add monitoring/alerting for the ingestion worker and background scheduler.
- Automate reporting exports and third-party integrations (payroll, HRIS).
