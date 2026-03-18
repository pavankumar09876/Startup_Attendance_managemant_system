from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from functools import lru_cache
import ipaddress

from app.database import get_db
from app.utils.security import decode_token
from app.models.user import User, Role

bearer_scheme = HTTPBearer()

# Cache role→permission mapping in memory (loaded once from the canonical map)
@lru_cache(maxsize=1)
def _get_role_permission_map() -> dict[str, set[str]]:
    from app.models.permission import ROLE_PERMISSIONS
    return {role: set(perms) for role, perms in ROLE_PERMISSIONS.items()}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    from app.models.revoked_token import RevokedToken
    from datetime import datetime, timezone
    token   = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Block refresh tokens from being used as access tokens
    if payload.get("type") == "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Use access token, not refresh token")

    # Revocation check (per-token jti)
    jti = payload.get("jti")
    if jti:
        revoked = (await db.execute(
            select(RevokedToken).where(RevokedToken.jti == jti)
        )).scalar_one_or_none()
        if revoked:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    user_id = payload.get("sub")
    result  = await db.execute(select(User).where(User.id == user_id))
    user    = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Revocation check (revoke-all by timestamp)
    iat = payload.get("iat")
    if user.revoked_all_before and iat:
        token_issued_at = datetime.fromtimestamp(iat, tz=timezone.utc)
        if token_issued_at < user.revoked_all_before:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalidated. Please log in again.")

    return user


def require_roles(*roles: Role):
    """Factory — returns a dependency that checks the user has one of the given roles.
    DEPRECATED: Use require_permission() for new endpoints.
    Kept for backward compatibility during migration.
    """
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in roles]}",
            )
        return current_user
    return _check


def require_permission(*permission_codes: str):
    """Factory — returns a dependency that checks the user has ANY of the given permissions.

    Usage:
        @router.post("/", dependencies=[Depends(require_permission("employee:create"))])
        async def create_employee(..., current_user = Depends(get_current_user)):

    Or as a direct dependency:
        current_user: User = Depends(require_permission("employee:create"))
    """
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        role_map = _get_role_permission_map()
        user_perms = role_map.get(current_user.role.value, set())

        # Super admin always passes
        if current_user.role == Role.SUPER_ADMIN:
            return current_user

        if not any(p in user_perms for p in permission_codes):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required permission: {list(permission_codes)}",
            )
        return current_user
    return _check


async def check_permission(user: User, db: AsyncSession, *permission_codes: str) -> None:
    """Imperative permission check — call directly inside endpoint bodies.

    Raises HTTPException(403) if the user lacks all of the given permissions.
    """
    if user.role == Role.SUPER_ADMIN:
        return
    role_map = _get_role_permission_map()
    user_perms = role_map.get(user.role.value, set())
    if not any(p in user_perms for p in permission_codes):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Required permission: {list(permission_codes)}",
        )


async def verify_reauth(
    user: User,
    password: str | None = None,
    mfa_code: str | None = None,
) -> None:
    """Verify re-authentication for sensitive actions.

    Requires at least one of: password or MFA code.
    Raises HTTPException(401) if verification fails.
    """
    from app.utils.security import verify_password

    if not password and not mfa_code:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Re-authentication required. Provide password or MFA code.",
        )

    if password:
        if not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password for re-authentication",
            )
        return  # password verified

    if mfa_code and user.mfa_enabled:
        from app.services.mfa import verify_totp
        if not verify_totp(user.mfa_secret, mfa_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid MFA code for re-authentication",
            )
        return  # MFA verified

    # MFA code provided but user doesn't have MFA enabled
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Re-authentication required. Provide your password.",
    )


async def enforce_ip_whitelist(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Check if the user's IP is in the admin whitelist for sensitive actions.

    Only enforced for ADMIN/SUPER_ADMIN/HR roles. If whitelist is empty, no restriction.
    """
    if current_user.role not in (Role.SUPER_ADMIN, Role.ADMIN, Role.HR):
        return current_user

    from app.models.settings import CompanySettings
    cs = (await db.execute(select(CompanySettings).limit(1))).scalar_one_or_none()
    if not cs or not cs.admin_ip_whitelist:
        return current_user  # No whitelist configured

    whitelist = cs.admin_ip_whitelist
    if not whitelist:
        return current_user

    client_ip = request.client.host if request.client else None
    if not client_ip:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot determine client IP for admin action",
        )

    try:
        client_addr = ipaddress.ip_address(client_ip)
        for entry in whitelist:
            try:
                if "/" in entry:
                    if client_addr in ipaddress.ip_network(entry, strict=False):
                        return current_user
                else:
                    if client_addr == ipaddress.ip_address(entry):
                        return current_user
            except ValueError:
                continue
    except ValueError:
        pass

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Admin action blocked: IP {client_ip} is not in the allowed whitelist",
    )
