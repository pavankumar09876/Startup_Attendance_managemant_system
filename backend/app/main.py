from fastapi import FastAPI, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Any, Dict
import os
import time
import logging

from app.config import settings
from app.utils.logging_config import setup_logging

setup_logging(debug=settings.DEBUG)
logger = logging.getLogger("workforce.api")

from app.database import get_db
from app.models.user import User
from app.models.project import Project, Task
from app.routers import auth, users, attendance, leave, projects
from app.routers import payroll, expenses, dashboard, reports
from app.routers import tasks_global, notifications_router, audit
from app.routers import settings_router
from app.routers import sprints as sprints_router
from app.routers import shifts as shifts_router
from app.routers import documents as documents_router
from app.routers import mfa as mfa_router
from app.utils.dependencies import get_current_user
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app_: FastAPI):
    # ── Start scheduler ────────────────────────────────────────────────────────
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from app.services.reminder_cron import run_reminders
    from app.services.absent_cron import run_auto_absent
    from app.services.carry_forward_cron import run_carry_forward
    from app.services.escalation_cron import run_escalation
    from app.services.digest_cron import run_digest
    scheduler = AsyncIOScheduler()
    scheduler.add_job(run_reminders,    'cron', minute='*',     id='reminders',    replace_existing=True)
    scheduler.add_job(run_auto_absent,  'cron', minute='*',     id='auto_absent',  replace_existing=True)
    scheduler.add_job(run_carry_forward,'cron', month=1, day=1, hour=0, minute=5,
                      id='carry_forward', replace_existing=True)
    scheduler.add_job(run_escalation,   'cron', hour=9, minute=0,
                      id='escalation',   replace_existing=True)
    scheduler.add_job(run_digest,       'cron', hour=8, minute=0,
                      id='daily_digest', replace_existing=True)
    import os as _os
    # Only start scheduler in one worker to avoid duplicate cron runs.
    # IMPORTANT: Default is "false" — you must explicitly set SCHEDULER_WORKER=true
    # on exactly ONE worker process (e.g. worker 0 or a dedicated scheduler process).
    if _os.getenv("SCHEDULER_WORKER", "false").lower() == "true":
        scheduler.start()
        logger.info("Scheduler started on this worker")
    else:
        logger.info("Scheduler disabled on this worker (set SCHEDULER_WORKER=true to enable)")
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── Rate limiter ───────────────────────────────────────────────────────────────
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.routers.auth import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request logging middleware ────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    logger.info(
        "%s %s → %s (%.1fms)",
        request.method, request.url.path, response.status_code, duration_ms,
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    return response

# ── Static file serving (uploaded files) ─────────────────────────────────────
os.makedirs("uploads", exist_ok=True)

# ── Protected file serving ────────────────────────────────────────────────────
import mimetypes
from fastapi.responses import FileResponse

@app.get("/api/files/{file_path:path}")
async def serve_file(
    file_path: str,
    current_user=Depends(get_current_user),
):
    """Serve uploaded files — requires authentication."""
    import pathlib
    # Prevent path traversal
    safe_root = pathlib.Path("uploads").resolve()
    requested  = (safe_root / file_path).resolve()
    if not str(requested).startswith(str(safe_root)):
        raise HTTPException(status_code=400, detail="Invalid file path")
    if not requested.exists():
        raise HTTPException(status_code=404, detail="File not found")
    media_type, _ = mimetypes.guess_type(str(requested))
    return FileResponse(str(requested), media_type=media_type or "application/octet-stream")

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
app.include_router(shifts_router.router,        prefix="/api")
app.include_router(documents_router.router,     prefix="/api")
app.include_router(mfa_router.router,           prefix="/api")


_app_start_time = time.time()


@app.get("/api/health")
async def health(db: AsyncSession = Depends(get_db)):
    from datetime import datetime, timezone
    # DB check
    try:
        from sqlalchemy import text
        await db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    # Redis check
    try:
        from redis.asyncio import from_url as redis_from_url
        redis_conn = redis_from_url(settings.REDIS_URL)
        await redis_conn.ping()
        await redis_conn.aclose()
        redis_status = "ok"
    except Exception:
        redis_status = "unavailable"

    # Uptime
    uptime_seconds = round(time.time() - _app_start_time, 1)

    # Worker / scheduler status
    scheduler_worker = os.getenv("SCHEDULER_WORKER", "false").lower() == "true"

    return {
        "status": "healthy" if db_status == "ok" and redis_status == "ok" else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "db": db_status,
        "redis": redis_status,
        "uptime_seconds": uptime_seconds,
        "scheduler_active": scheduler_worker,
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


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
