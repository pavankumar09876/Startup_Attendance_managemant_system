"""Dashboard router — /api/dashboard

Dashboard responses are cached in Redis for 5 minutes to avoid
re-running expensive aggregation queries on every request.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Dict

from app.database import get_db
from app.models.user import User
from app.utils.dependencies import get_current_user
from app.utils.cache import cache_get, cache_set
from app.services.dashboard_service import (
    get_admin_dashboard,
    get_manager_dashboard,
    get_employee_dashboard,
)
from app.services.exceptions import ServiceError

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

DASHBOARD_CACHE_TTL = 300  # 5 minutes


@router.get("/admin")
async def admin_dashboard(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    cache_key = "dashboard:admin"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        data = await get_admin_dashboard(db)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)
    await cache_set(cache_key, data, ttl=DASHBOARD_CACHE_TTL)
    return data


@router.get("/manager")
async def manager_dashboard(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    cache_key = f"dashboard:manager:{current_user.id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        data = await get_manager_dashboard(db, current_user.id)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)
    await cache_set(cache_key, data, ttl=DASHBOARD_CACHE_TTL)
    return data


@router.get("/employee")
async def employee_dashboard(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    cache_key = f"dashboard:employee:{current_user.id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        data = await get_employee_dashboard(db, current_user.id)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)
    await cache_set(cache_key, data, ttl=DASHBOARD_CACHE_TTL)
    return data
