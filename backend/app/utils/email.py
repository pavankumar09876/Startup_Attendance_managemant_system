"""
Email utility — sends via SMTP if configured, otherwise logs to console.
Import and call send_welcome_email() or send_reset_email() from routers.
"""
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import settings

logger = logging.getLogger(__name__)


def _send(to: str, subject: str, html: str) -> None:
    """Low-level send. Falls back to console log if SMTP not configured."""
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.info(
            "\n📧 [EMAIL — SMTP not configured, printing to console]\n"
            f"  To:      {to}\n"
            f"  Subject: {subject}\n"
            f"  Body:\n{html}\n"
        )
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = settings.EMAIL_FROM
    msg["To"]      = to
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASS or "")
            server.sendmail(settings.EMAIL_FROM, to, msg.as_string())
        logger.info(f"Email sent to {to}: {subject}")
    except Exception as exc:
        logger.error(f"Failed to send email to {to}: {exc}")


def send_welcome_email(to: str, full_name: str, temp_password: str) -> None:
    subject = f"Welcome to {settings.APP_NAME} — Your Account is Ready"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="color:#1e40af;margin-bottom:4px">Welcome to {settings.APP_NAME}!</h2>
      <p style="color:#6b7280;margin-top:0">Hi <strong>{full_name}</strong>, your account has been created.</p>

      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:20px;margin:24px 0">
        <p style="margin:0 0 8px 0;color:#0369a1;font-weight:600">Your login credentials</p>
        <p style="margin:4px 0;color:#374151"><strong>Email:</strong> {to}</p>
        <p style="margin:4px 0;color:#374151"><strong>Temporary Password:</strong>
          <code style="background:#e0f2fe;padding:2px 8px;border-radius:4px;font-size:15px">{temp_password}</code>
        </p>
      </div>

      <p style="color:#374151">
        You will be asked to <strong>set a new password</strong> when you log in for the first time.
      </p>

      <a href="http://localhost:5173/auth/login"
         style="display:inline-block;background:#1d4ed8;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
        Log In Now
      </a>

      <p style="color:#9ca3af;font-size:12px;margin-top:32px">
        If you did not expect this email, please contact your HR team.
      </p>
    </div>
    """
    _send(to, subject, html)


async def send_invite_email(to: str, full_name: str, invite_url: str, expiry_hours: int = 72) -> None:
    """Send invite link for password setup (no temp password)."""
    subject = f"Welcome to {settings.APP_NAME} — Set Up Your Account"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="color:#1e40af;margin-bottom:4px">Welcome to {settings.APP_NAME}!</h2>
      <p style="color:#6b7280;margin-top:0">Hi <strong>{full_name}</strong>, your account has been created.</p>

      <p style="color:#374151">
        Click the button below to set your password and activate your account.
        This link expires in <strong>{expiry_hours} hours</strong>.
      </p>

      <a href="{invite_url}"
         style="display:inline-block;background:#1d4ed8;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0">
        Set Up My Account
      </a>

      <p style="color:#9ca3af;font-size:12px;margin-top:32px">
        If you did not expect this email, please contact your HR team.
      </p>
    </div>
    """
    _send(to, subject, html)


async def send_joining_instructions_email(
    to: str, full_name: str, subject: str, body_html: str, manager_name: str = "TBD"
) -> None:
    """Send pre-joining instructions to a new employee."""
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="color:#1e40af;margin-bottom:4px">Joining Instructions</h2>
      <p style="color:#6b7280;margin-top:0">Hi <strong>{full_name}</strong>,</p>

      <p style="color:#374151"><strong>Reporting Manager:</strong> {manager_name}</p>

      <div style="margin:20px 0;padding:16px;background:#f8fafc;border-radius:8px">
        {body_html}
      </div>

      <p style="color:#9ca3af;font-size:12px;margin-top:32px">
        If you have questions, please reach out to your HR team or reporting manager.
      </p>
    </div>
    """
    _send(to, subject, html)


def send_reset_email(to: str, full_name: str, reset_token: str) -> None:
    reset_url = f"http://localhost:5173/auth/reset-password?token={reset_token}"
    subject = f"{settings.APP_NAME} — Password Reset Request"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="color:#1e40af;margin-bottom:4px">Reset Your Password</h2>
      <p style="color:#6b7280;margin-top:0">Hi <strong>{full_name}</strong>,</p>
      <p style="color:#374151">We received a request to reset your password. Click the button below to set a new one.</p>

      <a href="{reset_url}"
         style="display:inline-block;background:#1d4ed8;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0">
        Reset Password
      </a>

      <p style="color:#374151">This link expires in <strong>1 hour</strong>.</p>
      <p style="color:#9ca3af;font-size:12px">If you did not request a password reset, you can safely ignore this email.</p>
    </div>
    """
    _send(to, subject, html)
