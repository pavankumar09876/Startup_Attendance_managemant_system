"""Dashboard router — /api/dashboard"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Dict

from app.database import get_db
from app.models.user import User
from app.utils.dependencies import get_current_user
from app.services.dashboard_service import (
    get_admin_dashboard,
    get_manager_dashboard,
    get_employee_dashboard,
)
from app.services.exceptions import ServiceError

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/admin")
async def admin_dashboard(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        return await get_admin_dashboard(db)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)


@router.get("/manager")
async def manager_dashboard(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        return await get_manager_dashboard(db, current_user.id)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)


@router.get("/employee")
async def employee_dashboard(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        return await get_employee_dashboard(db, current_user.id)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)
