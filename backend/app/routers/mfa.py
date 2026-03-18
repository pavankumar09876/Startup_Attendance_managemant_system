"""MFA endpoints — setup, verify, disable, backup codes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List

from app.database import get_db
from app.models.user import User
from app.utils.dependencies import get_current_user
from app.utils.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.schemas.user import UserOut, TokenOut
from app.services.mfa import (
    generate_mfa_secret, generate_totp_uri, generate_qr_code,
    verify_totp, generate_backup_codes, hash_backup_codes, verify_backup_code,
)

router = APIRouter(prefix="/mfa", tags=["MFA"])


# ── Request/Response schemas ─────────────────────────────────────────────────
class MfaSetupOut(BaseModel):
    secret: str
    qr_code: str  # base64 PNG
    backup_codes: List[str]


class MfaVerifyRequest(BaseModel):
    code: str


class MfaDisableRequest(BaseModel):
    password: str
    code: str


class MfaLoginVerify(BaseModel):
    mfa_token: str
    code: str


class MfaBackupVerify(BaseModel):
    mfa_token: str
    code: str


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/setup", response_model=MfaSetupOut)
async def mfa_setup(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate TOTP secret + QR code. Does NOT enable MFA yet — call /verify-setup."""
    if current_user.mfa_enabled:
        raise HTTPException(400, "MFA is already enabled")

    secret = generate_mfa_secret()
    uri = generate_totp_uri(secret, current_user.email)
    qr = generate_qr_code(uri)
    backup = generate_backup_codes()

    # Store secret temporarily (not yet enabled)
    current_user.mfa_secret = secret
    current_user.mfa_backup_codes = hash_backup_codes(backup)
    await db.commit()

    return MfaSetupOut(secret=secret, qr_code=qr, backup_codes=backup)


@router.post("/verify-setup")
async def mfa_verify_setup(
    payload: MfaVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify TOTP code to confirm setup and enable MFA."""
    if not current_user.mfa_secret:
        raise HTTPException(400, "Call /mfa/setup first")
    if current_user.mfa_enabled:
        raise HTTPException(400, "MFA is already enabled")

    if not verify_totp(current_user.mfa_secret, payload.code):
        raise HTTPException(400, "Invalid code. Try again.")

    current_user.mfa_enabled = True
    await db.commit()
    return {"message": "MFA enabled successfully"}


@router.post("/disable")
async def mfa_disable(
    payload: MfaDisableRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable MFA. Requires password + current TOTP code."""
    if not current_user.mfa_enabled:
        raise HTTPException(400, "MFA is not enabled")
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(400, "Invalid password")
    if not verify_totp(current_user.mfa_secret, payload.code):
        raise HTTPException(400, "Invalid TOTP code")

    current_user.mfa_enabled = False
    current_user.mfa_secret = None
    current_user.mfa_backup_codes = None
    await db.commit()
    return {"message": "MFA disabled"}


@router.post("/verify", response_model=TokenOut)
async def mfa_verify(
    payload: MfaLoginVerify,
    db: AsyncSession = Depends(get_db),
):
    """Verify TOTP during login flow. Accepts mfa_token + code, returns full tokens."""
    from sqlalchemy import select

    token_data = decode_token(payload.mfa_token)
    if not token_data or token_data.get("type") != "mfa":
        raise HTTPException(401, "Invalid or expired MFA token")

    user_id = token_data.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "User not found")

    if not verify_totp(user.mfa_secret, payload.code):
        raise HTTPException(400, "Invalid TOTP code")

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role.value})
    return TokenOut(access_token=access_token, refresh_token=refresh_token, user=UserOut.model_validate(user))


@router.post("/backup-verify", response_model=TokenOut)
async def mfa_backup_verify(
    payload: MfaBackupVerify,
    db: AsyncSession = Depends(get_db),
):
    """Use a backup code during login. Burns the code after use."""
    from sqlalchemy import select

    token_data = decode_token(payload.mfa_token)
    if not token_data or token_data.get("type") != "mfa":
        raise HTTPException(401, "Invalid or expired MFA token")

    user_id = token_data.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.mfa_backup_codes:
        raise HTTPException(401, "User not found or no backup codes")

    valid, remaining = verify_backup_code(user.mfa_backup_codes, payload.code)
    if not valid:
        raise HTTPException(400, "Invalid backup code")

    user.mfa_backup_codes = remaining
    await db.commit()

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role.value})
    return TokenOut(access_token=access_token, refresh_token=refresh_token, user=UserOut.model_validate(user))
