"""Audit log router — /api/audit"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import uuid

from app.database import get_db
from app.models.notification import AuditLog
from app.models.user import User, Role
from app.schemas.notification import AuditLogOut
from app.utils.dependencies import require_roles

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/", response_model=list[AuditLogOut])
async def list_audit_logs(
    entity_type: Optional[str]       = None,
    entity_id:   Optional[str]       = None,
    actor_id:    Optional[uuid.UUID] = None,
    skip:        int = Query(0, ge=0),
    limit:       int = Query(50, ge=1, le=200),
    db:          AsyncSession = Depends(get_db),
    _:           User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    q = select(AuditLog)
    if entity_type:
        q = q.where(AuditLog.entity_type == entity_type)
    if entity_id:
        q = q.where(AuditLog.entity_id == entity_id)
    if actor_id:
        q = q.where(AuditLog.actor_id == actor_id)
    q = q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


# ── Helper used by other routers to write audit entries ──────────────────────
async def write_audit(
    db:          AsyncSession,
    actor:       User,
    action:      str,
    entity_type: str,
    entity_id:   str = None,
    description: str = None,
    metadata:    dict = None,
    ip_address:  str = None,
):
    import json
    log = AuditLog(
        actor_id    = actor.id if actor else None,
        actor_name  = f"{actor.first_name} {actor.last_name}" if actor else "System",
        action      = action,
        entity_type = entity_type,
        entity_id   = entity_id,
        description = description,
        metadata_   = json.dumps(metadata) if metadata else None,
        ip_address  = ip_address,
    )
    db.add(log)
    # flush so it's part of the same transaction
    await db.flush()
