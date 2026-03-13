from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
import secrets
import asyncio

from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserLogin, TokenOut, UserOut, ChangePassword,
    ForgotPasswordRequest, ResetPasswordRequest, SetFirstPassword,
)
from app.utils.security import verify_password, create_access_token, hash_password
from app.utils.dependencies import get_current_user
from app.utils.email import send_reset_email

router = APIRouter(prefix="/auth", tags=["Auth"])

RESET_TOKEN_EXPIRE_HOURS = 1


@router.post("/login", response_model=TokenOut)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
async def change_password(
    payload: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

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
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    current_user.hashed_password      = hash_password(payload.new_password)
    current_user.must_change_password = False
    await db.commit()
    return {"message": "Password set successfully"}


@router.post("/forgot-password")
async def forgot_password(
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
            asyncio.to_thread(send_reset_email, user.email, full_name, token)
        )

    return {"message": "If that email is registered you will receive a reset link shortly."}


@router.post("/reset-password")
async def reset_password(
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
    if expires is None or expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user.hashed_password           = hash_password(payload.new_password)
    user.password_reset_token      = None
    user.password_reset_expires_at = None
    user.must_change_password      = False
    await db.commit()
    return {"message": "Password reset successfully. You can now log in."}
