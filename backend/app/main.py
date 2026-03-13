from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Any, Dict
import os

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.project import Project, Task
from app.routers import auth, users, attendance, leave, projects
from app.routers import payroll, expenses, dashboard, reports
from app.routers import tasks_global, notifications_router, audit
from app.routers import settings_router
from app.routers import sprints as sprints_router
from app.utils.dependencies import get_current_user

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static file serving (uploaded files) ─────────────────────────────────────
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,                 prefix="/api")
app.include_router(users.router,                prefix="/api")
app.include_router(attendance.router,           prefix="/api")
app.include_router(leave.router,                prefix="/api")
app.include_router(projects.router,             prefix="/api")
app.include_router(tasks_global.router,         prefix="/api")
app.include_router(payroll.router,              prefix="/api")
app.include_router(expenses.router,             prefix="/api")
app.include_router(dashboard.router,            prefix="/api")
app.include_router(reports.router,              prefix="/api")
app.include_router(settings_router.router,      prefix="/api")
app.include_router(notifications_router.router, prefix="/api")
app.include_router(audit.router,                prefix="/api")
app.include_router(sprints_router.router,       prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}


# ── Global search ─────────────────────────────────────────────────────────────
@app.get("/api/search")
async def global_search(
    q:            str = Query(..., min_length=1),
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Search employees, projects, and tasks in one call (Ctrl+K palette)."""
    pattern = f"%{q}%"

    # Employees
    emp_result = await db.execute(
        select(User).where(
            or_(
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                User.email.ilike(pattern),
                User.employee_id.ilike(pattern),
            )
        ).limit(5)
    )
    employees = [
        {
            "id":    str(u.id),
            "type":  "employee",
            "title": f"{u.first_name} {u.last_name}",
            "subtitle": u.designation or u.role,
            "link":  f"/staff/{u.id}",
        }
        for u in emp_result.scalars().all()
    ]

    # Projects
    proj_result = await db.execute(
        select(Project).where(Project.name.ilike(pattern)).limit(5)
    )
    projects_data = [
        {
            "id":       str(p.id),
            "type":     "project",
            "title":    p.name,
            "subtitle": p.status,
            "link":     f"/projects/{p.id}",
        }
        for p in proj_result.scalars().all()
    ]

    # Tasks
    task_result = await db.execute(
        select(Task).where(Task.title.ilike(pattern)).limit(5)
    )
    tasks_data = [
        {
            "id":       str(t.id),
            "type":     "task",
            "title":    t.title,
            "subtitle": f"{t.status} · {t.priority}",
            "link":     f"/tasks",
        }
        for t in task_result.scalars().all()
    ]

    return {"results": employees + projects_data + tasks_data}
