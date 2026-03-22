from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
import secrets
import asyncio
import uuid
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel
from typing import List, Optional

from app.database import get_db
from app.models.user import User, EmployeeStatus
from app.models.revoked_token import RevokedToken
from app.models.session import UserSession
from app.schemas.user import (
    UserLogin, TokenOut, UserOut, ChangePassword,
    ForgotPasswordRequest, ResetPasswordRequest, SetFirstPassword,
)
from app.utils.security import verify_password, create_access_token, create_refresh_token, create_mfa_token, hash_password, decode_token
from app.utils.dependencies import get_current_user, bearer_scheme
from app.utils.email import send_reset_email
import re
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

limiter = Limiter(key_func=get_remote_address)


def validate_password_strength(password: str) -> None:
    """Validate password meets strength requirements."""
    errors = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not re.search(r'[A-Z]', password):
        errors.append("at least 1 uppercase letter")
    if not re.search(r'[a-z]', password):
        errors.append("at least 1 lowercase letter")
    if not re.search(r'\d', password):
        errors.append("at least 1 digit")
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>/?`~]', password):
        errors.append("at least 1 special character")
    if errors:
        raise HTTPException(
            status_code=400,
            detail=f"Password must contain: {', '.join(errors)}"
        )


async def _send_email_safe(coro):
    """Wrapper to log email sending failures instead of silently swallowing them."""
    try:
        await coro
    except Exception as e:
        logger.error(f"Email send failed: {e}", exc_info=True)

RESET_TOKEN_EXPIRE_HOURS = 1
MAX_CONCURRENT_SESSIONS = 5


# ── Session schemas ──────────────────────────────────────────────────────────
class SessionOut(BaseModel):
    id: str
    device_info: Optional[str] = None
    ip_address: Optional[str] = None
    last_active: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, payload: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        if hasattr(user, 'status') and user.status == EmployeeStatus.SUSPENDED:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended. Contact your administrator.")
        if hasattr(user, 'status') and user.status == EmployeeStatus.TERMINATED:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account has been terminated")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    # Transition INVITED → ACTIVE on first login
    if hasattr(user, 'status') and user.status == EmployeeStatus.INVITED:
        user.status = EmployeeStatus.ACTIVE

    # MFA check — return short-lived mfa_token instead of full tokens
    if user.mfa_enabled:
        mfa_token = create_mfa_token({"sub": str(user.id)})
        return {"requires_mfa": True, "mfa_token": mfa_token}

    access_token  = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role.value})

    # Create session record + enforce max concurrent sessions
    refresh_payload = decode_token(refresh_token)
    if refresh_payload:
        active_sessions = (await db.execute(
            select(UserSession).where(
                UserSession.user_id == user.id,
                UserSession.is_active == True,
            ).order_by(UserSession.created_at.asc())
        )).scalars().all()
        if len(active_sessions) >= MAX_CONCURRENT_SESSIONS:
            active_sessions[0].is_active = False
        db.add(UserSession(
            user_id=user.id,
            jti=refresh_payload.get("jti", ""),
            device_info=(request.headers.get("user-agent") or "")[:500],
            ip_address=request.client.host if request.client else None,
        ))
        await db.commit()

    return TokenOut(access_token=access_token, refresh_token=refresh_token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/sessions", response_model=List[SessionOut])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List active sessions for current user."""
    result = await db.execute(
        select(UserSession).where(
            UserSession.user_id == current_user.id,
            UserSession.is_active == True,
        ).order_by(UserSession.created_at.desc())
    )
    sessions = result.scalars().all()
    return [SessionOut(
        id=str(s.id), device_info=s.device_info, ip_address=s.ip_address,
        last_active=s.last_active, created_at=s.created_at,
    ) for s in sessions]


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a specific session."""
    result = await db.execute(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    session.is_active = False
    # Also revoke the refresh token jti
    if session.jti:
        db.add(RevokedToken(jti=session.jti, user_id=str(current_user.id)))
    await db.commit()
    return {"message": "Session revoked"}


@router.post("/change-password")
async def change_password(
    payload: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    validate_password_strength(payload.new_password)

    current_user.hashed_password      = hash_password(payload.new_password)
    current_user.must_change_password = False
    await db.commit()
    return {"message": "Password changed successfully"}


@router.post("/set-password")
async def set_first_password(
    payload: SetFirstPassword,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Called on first login when must_change_password=True. No old password required."""
    validate_password_strength(payload.new_password)

    current_user.hashed_password      = hash_password(payload.new_password)
    current_user.must_change_password = False
    await db.commit()
    return {"message": "Password set successfully"}


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Always returns 200 to prevent email enumeration."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user   = result.scalar_one_or_none()

    if user and user.is_active:
        token  = secrets.token_urlsafe(32)
        expiry = datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)
        user.password_reset_token      = token
        user.password_reset_expires_at = expiry
        await db.commit()

        full_name = f"{user.first_name} {user.last_name}"
        asyncio.create_task(
            _send_email_safe(asyncio.to_thread(send_reset_email, user.email, full_name, token))
        )

    return {"message": "If that email is registered you will receive a reset link shortly."}


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.password_reset_token == payload.token)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    expires = user.password_reset_expires_at
    if expires is None or expires.astimezone(timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")

    validate_password_strength(payload.new_password)

    user.hashed_password           = hash_password(payload.new_password)
    user.password_reset_token      = None
    user.password_reset_expires_at = None
    user.must_change_password      = False
    await db.commit()
    return {"message": "Password reset successfully. You can now log in."}


@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Revoke the current access token so it cannot be reused."""
    payload = decode_token(credentials.credentials)
    if payload:
        jti = payload.get("jti")
        exp = payload.get("exp")
        sub = payload.get("sub")
        if jti:
            expires_dt = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else None
            db.add(RevokedToken(jti=jti, user_id=sub or "", expires_at=expires_dt))
            await db.commit()
    return {"message": "Logged out successfully"}


@router.post("/logout-all")
async def logout_all(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke all sessions by setting revoked_all_before timestamp on the user."""
    # Also revoke the current token's jti
    payload = decode_token(credentials.credentials)
    if payload:
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti:
            expires_dt = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else None
            db.add(RevokedToken(jti=jti, user_id=str(current_user.id), expires_at=expires_dt))

    # Deactivate all sessions
    active_sessions = (await db.execute(
        select(UserSession).where(
            UserSession.user_id == current_user.id,
            UserSession.is_active == True,
        )
    )).scalars().all()
    for s in active_sessions:
        s.is_active = False

    # Set timestamp — any token issued before now is invalid
    current_user.revoked_all_before = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "All sessions invalidated. Other devices will be signed out on their next request."}


@router.post("/refresh", response_model=TokenOut)
async def refresh_token_endpoint(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    # Check if refresh token jti is revoked
    jti = payload.get("jti")
    if jti:
        revoked = (await db.execute(
            select(RevokedToken).where(RevokedToken.jti == jti)
        )).scalar_one_or_none()
        if revoked:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has been revoked")

    user_id = payload.get("sub")
    result  = await db.execute(select(User).where(User.id == user_id))
    user    = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Check revoked_all_before against this refresh token's iat
    iat = payload.get("iat")
    if user.revoked_all_before and iat:
        token_issued_at = datetime.fromtimestamp(iat, tz=timezone.utc)
        if token_issued_at < user.revoked_all_before:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalidated. Please log in again.")

    # Revoke the old refresh token jti
    if jti:
        exp = payload.get("exp")
        expires_dt = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else None
        db.add(RevokedToken(jti=jti, user_id=str(user.id), expires_at=expires_dt))

    # Issue new pair
    new_access  = create_access_token({"sub": str(user.id), "role": user.role.value})
    new_refresh = create_refresh_token({"sub": str(user.id), "role": user.role.value})
    await db.commit()
    return TokenOut(access_token=new_access, refresh_token=new_refresh, user=UserOut.model_validate(user))


# ── Accept Invite (public — no auth required) ────────────────────────────────

class AcceptInviteRequest(BaseModel):
    token: str
    new_password: str


@router.post("/accept-invite")
@limiter.limit("10/minute")
async def accept_invite(
    request: Request,
    payload: AcceptInviteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Validate invite token, set password, and return tokens."""
    # Validate password strength
    pw = payload.new_password
    if len(pw) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if not re.search(r"[A-Z]", pw):
        raise HTTPException(400, "Password must contain an uppercase letter")
    if not re.search(r"[a-z]", pw):
        raise HTTPException(400, "Password must contain a lowercase letter")
    if not re.search(r"[0-9]", pw):
        raise HTTPException(400, "Password must contain a digit")

    from app.services.onboarding_service import accept_invite as svc_accept_invite
    user = await svc_accept_invite(db, payload.token, pw)

    # Create session + tokens
    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role.value})

    session = UserSession(
        user_id=user.id,
        jti=secrets.token_hex(16),
        device_info=request.headers.get("User-Agent", "unknown"),
        ip_address=request.client.host if request.client else "unknown",
        last_active=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()

    return TokenOut(access_token=access_token, refresh_token=refresh_token, user=UserOut.model_validate(user))
