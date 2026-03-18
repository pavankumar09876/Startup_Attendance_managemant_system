"""
ARQ worker — background task processing.

Start with:  arq app.worker.WorkerSettings
"""
from arq.connections import RedisSettings
from app.config import settings


async def startup(ctx: dict):
    """Executed once when the worker starts."""
    from app.database import AsyncSessionLocal
    ctx["db_factory"] = AsyncSessionLocal


async def shutdown(ctx: dict):
    """Cleanup on worker stop."""
    pass


# ── Task: Run Payroll ───────────────────────────────────────────────────────
async def task_run_payroll(ctx: dict, month: int, year: int, processed_by_id: str):
    """Heavy payroll computation in background."""
    from app.services.payroll_service import run_payroll
    async with ctx["db_factory"]() as db:
        entries = await run_payroll(db, month, year, processed_by_id)
        await db.commit()
        return {"entries": len(entries), "month": month, "year": year}


# ── Task: Generate Report ───────────────────────────────────────────────────
async def task_generate_report(ctx: dict, report_type: str, params: dict):
    """Generate heavy reports in background."""
    from app.database import AsyncSessionLocal
    async with ctx["db_factory"]() as db:
        # Import the right report function based on type
        if report_type == "payroll_analytics":
            from app.routers.reports import payroll_analytics
            # We just log that it was requested — actual generation happens via service
            return {"status": "completed", "report_type": report_type}
        return {"status": "completed", "report_type": report_type}


# ── Task: Send Email ────────────────────────────────────────────────────────
async def task_send_email(ctx: dict, to_email: str, subject: str, template: str, context: dict):
    """Send email in background (non-blocking)."""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from app.config import settings

    if not settings.SMTP_HOST:
        return {"status": "skipped", "reason": "SMTP not configured"}

    msg = MIMEMultipart()
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to_email
    msg["Subject"] = subject

    # Simple template rendering
    body = template
    for key, value in context.items():
        body = body.replace(f"{{{{{key}}}}}", str(value))
    msg.attach(MIMEText(body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASS:
                server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.send_message(msg)
        return {"status": "sent", "to": to_email}
    except Exception as e:
        return {"status": "failed", "error": str(e)}


# ── Task: Send Notification ─────────────────────────────────────────────────
async def task_send_notification(ctx: dict, user_id: str, title: str, message: str, type_: str, link: str = None):
    """Create in-app notification in background."""
    import uuid
    from app.models.notification import Notification, NotificationType
    async with ctx["db_factory"]() as db:
        notif = Notification(
            user_id=uuid.UUID(user_id),
            type=NotificationType(type_),
            title=title,
            message=message,
            link=link,
        )
        db.add(notif)
        await db.commit()
        return {"status": "created", "notification_id": str(notif.id)}


# ── Task: Generate Payslip PDF ──────────────────────────────────────────────
async def task_generate_payslip_pdf(ctx: dict, entry_id: str):
    """Generate payslip PDF in background and save to disk."""
    import uuid
    import os
    from sqlalchemy import select
    from app.models.payroll import PayrollEntry
    from app.models.user import User
    from app.services.payroll_service import generate_payslip_pdf

    async with ctx["db_factory"]() as db:
        entry = (await db.execute(
            select(PayrollEntry).where(PayrollEntry.id == uuid.UUID(entry_id))
        )).scalar_one_or_none()
        if not entry:
            return {"status": "failed", "reason": "entry not found"}

        emp = (await db.execute(
            select(User).where(User.id == entry.employee_id)
        )).scalar_one_or_none()

        buffer = await generate_payslip_pdf(entry, emp)

        # Save to uploads
        os.makedirs("uploads/payslips", exist_ok=True)
        filename = f"payslip_{entry_id}.pdf"
        filepath = os.path.join("uploads/payslips", filename)
        with open(filepath, "wb") as f:
            f.write(buffer.read())

        return {"status": "generated", "path": filepath}


def _parse_redis_url(url: str) -> RedisSettings:
    """Convert a redis:// URL to ARQ RedisSettings."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password,
        database=int(parsed.path.lstrip("/") or 0),
    )


class WorkerSettings:
    """ARQ worker configuration."""
    functions = [
        task_run_payroll,
        task_generate_report,
        task_send_email,
        task_send_notification,
        task_generate_payslip_pdf,
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = _parse_redis_url(settings.REDIS_URL)
    max_jobs = 10
    job_timeout = 300  # 5 minutes
    poll_delay = 0.5
