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
    category:   str = "general"
    action_type: Optional[str] = None
    action_entity_type: Optional[str] = None
    action_entity_id: Optional[UUID4] = None
    is_actioned: bool = False
    priority:   str = "normal"
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationActionRequest(BaseModel):
    action: str  # "approve" or "reject"
    comment: Optional[str] = None


class NotificationSummaryOut(BaseModel):
    total: int = 0
    leave: int = 0
    task: int = 0
    attendance: int = 0
    payroll: int = 0
    expense: int = 0
    system: int = 0


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
