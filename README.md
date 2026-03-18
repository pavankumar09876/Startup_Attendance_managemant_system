# Workforce Pro

Full-stack HR & Workforce Management SaaS application built with FastAPI and React.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | JWT (access + refresh tokens), MFA (TOTP) |
| Infra | Docker Compose |

## Features

- **Attendance** — Clock in/out, breaks, regularization requests, team view, CSV export, heatmap
- **Leave Management** — Apply, approve/reject, holiday calendar, leave balance tracking, carry-forward
- **Projects & Tasks** — Kanban board, sprints, burndown charts, backlog management
- **Staff Management** — Employee CRUD, departments, org chart, bulk import, document uploads
- **Payroll & Expenses** — Run payroll, payslips (PDF), statutory deductions (PF/ESI), expense claims
- **Reports & Analytics** — Attendance, payroll, project, and team reports with scheduling
- **Settings** — Company profile, attendance rules, leave policies, shifts, notifications, roles & permissions
- **Dashboard** — Role-specific views (Admin, Manager, Employee)
- **Security** — Rate limiting, token revocation, forced password change, MFA

## Roles

| Role | Access Level |
|------|-------------|
| Super Admin | Full system access |
| Admin | Company administration |
| HR | Staff, leave, payroll management |
| Manager | Direct reports management |
| Employee | Self-service only |

## Project Structure

```
workforce-pro/
├── backend/            # FastAPI application
│   ├── app/
│   │   ├── models/     # SQLAlchemy ORM models
│   │   ├── routers/    # API endpoints (17 routers)
│   │   ├── schemas/    # Pydantic request/response models
│   │   ├── services/   # Business logic & cron jobs
│   │   └── utils/      # Auth, security, email helpers
│   ├── alembic/        # Database migrations (18 versions)
│   ├── tests/          # pytest integration tests
│   └── seed.py         # Database seeder
├── frontend/           # React SPA
│   └── src/
│       ├── pages/      # Feature pages (12 modules)
│       ├── components/ # Shared UI components
│       ├── services/   # API client layer
│       ├── hooks/      # Custom React hooks
│       ├── store/      # Zustand state management
│       └── types/      # TypeScript interfaces
├── e2e/                # Playwright end-to-end tests
└── docker-compose.yml  # Full stack orchestration
```

## Quick Start

### Option 1: Docker Compose (recommended)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your database password and secret key

# 2. Start all services
docker compose up -d

# 3. Run migrations
docker compose exec backend alembic upgrade head

# 4. Seed default users
docker compose exec backend python seed.py
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Option 2: Local Development

**Prerequisites:** Python 3.11+, Node.js 18+, PostgreSQL 16, Redis 7

```bash
# 1. Database
createdb workforce_pro

# 2. Backend
cd backend
python -m venv ../attendence_venv
source ../attendence_venv/bin/activate   # Windows: ..\attendence_venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                     # Edit DATABASE_URL, SECRET_KEY
alembic upgrade head
python seed.py
uvicorn app.main:app --reload

# 3. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env                     # Edit VITE_API_URL if needed
npm run dev
```

Frontend runs at http://localhost:3000, backend at http://localhost:8000.

## Default Users

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@gmail.com | Superadmin123$ |
| Admin | admin@gmail.com | Admin123$ |
| Manager | manager1@gmail.com | Manager123$ |
| Manager | manager2@gmail.com | Manager123$ |

> Change these passwords immediately after first login.

## Environment Variables

See [.env.example](.env.example) for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (asyncpg) |
| `SECRET_KEY` | JWT signing key (min 32 chars in production) |
| `ALLOWED_ORIGINS` | CORS allowed origins |
| `REDIS_URL` | Redis connection string |
| `VITE_API_URL` | Backend URL for frontend |

## API Documentation

With the backend running, visit:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Health Check:** http://localhost:8000/api/health

## Testing

```bash
# Backend tests
cd backend
pytest

# Frontend unit tests
cd frontend
npm test

# E2E tests
npm run e2e
```

## License

Proprietary. All rights reserved.
