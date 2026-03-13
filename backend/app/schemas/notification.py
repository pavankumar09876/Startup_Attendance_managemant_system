from pydantic import BaseModel, UUID4
from typing import Optional
from datetime import datetime
from app.models.notification import NotificationType


class NotificationOut(BaseModel):
    id:         UUID4
    user_id:    UUID4
    type:       NotificationType
    title:      str
    message:    str
    link:       Optional[str] = None
    is_read:    bool
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogOut(BaseModel):
    id:          UUID4
    actor_id:    Optional[UUID4] = None
    actor_name:  Optional[str]   = None
    action:      str
    entity_type: str
    entity_id:   Optional[str]   = None
    description: Optional[str]   = None
    ip_address:  Optional[str]   = None
    created_at:  datetime

    class Config:
        from_attributes = True
