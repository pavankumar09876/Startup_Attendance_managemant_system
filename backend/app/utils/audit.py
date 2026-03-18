"""
Audit log utility — records who did what, when.

Usage:
    await log_action(db, user, "employee.created", "User", str(new_user.id),
                     description=f"Created employee {new_user.email}")
"""
import json
from typing import Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import AuditLog
from app.models.user import User


async def log_action(
    db: AsyncSession,
    actor: User,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    description: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Create an immutable audit log entry."""
    entry = AuditLog(
        actor_id=actor.id,
        actor_name=f"{actor.first_name} {actor.last_name}",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        metadata_=json.dumps(metadata) if metadata else None,
        ip_address=ip_address,
    )
    db.add(entry)
    # Don't commit — let the caller's transaction handle it
    return entry
