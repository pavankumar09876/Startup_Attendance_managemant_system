"""Notifications router — /api/notifications + WebSocket /ws/notifications"""
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from typing import Dict, Optional
from datetime import datetime, timezone, timedelta
import asyncio
import json
import uuid

from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationOut, NotificationActionRequest, NotificationSummaryOut
from app.utils.dependencies import get_current_user
from app.utils.security import decode_token

router = APIRouter(prefix="/notifications", tags=["Notifications"])

# ── In-memory connection manager ─────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, WebSocket] = {}   # user_id → websocket

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active[user_id] = ws

    def disconnect(self, user_id: str):
        self.active.pop(user_id, None)

    async def send_to_user(self, user_id: str, data: dict):
        ws = self.active.get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                self.disconnect(user_id)

    async def broadcast(self, data: dict):
        for uid, ws in list(self.active.items()):
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                self.disconnect(uid)


manager = ConnectionManager()


# ── WebSocket endpoint ────────────────────────────────────────────────────────
@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token:     str = Query(...),
):
    """Connect with ?token=<jwt>. Server pushes new notifications in real-time."""
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = str(payload.get("sub"))
    await manager.connect(user_id, websocket)
    try:
        while True:
            # Keep connection alive — client sends pings
            await asyncio.wait_for(websocket.receive_text(), timeout=60)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        manager.disconnect(user_id)


# ── REST endpoints ────────────────────────────────────────────────────────────
@router.get("/", response_model=list[NotificationOut])
async def list_notifications(
    unread_only:  bool = False,
    category:     Optional[str] = None,
    priority:     Optional[str] = None,
    skip:         int  = Query(0, ge=0),
    limit:        int  = Query(20, ge=1, le=100),
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        q = q.where(Notification.is_read == False)
    if category:
        q = q.where(Notification.category == category)
    if priority:
        q = q.where(Notification.priority == priority)
    q = q.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/summary", response_model=NotificationSummaryOut)
async def notification_summary(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unread count by category."""
    rows = (await db.execute(
        select(Notification.category, func.count(Notification.id))
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
        .group_by(Notification.category)
    )).all()

    counts = {r[0]: r[1] for r in rows}
    total = sum(counts.values())
    return NotificationSummaryOut(
        total=total,
        leave=counts.get("leave", 0),
        task=counts.get("task", 0),
        attendance=counts.get("attendance", 0),
        payroll=counts.get("payroll", 0),
        expense=counts.get("expense", 0),
        system=counts.get("system", 0) + counts.get("general", 0),
    )


@router.get("/unread-count")
async def unread_count(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )).scalar()
    return {"count": count}


@router.post("/{notif_id}/action")
async def action_notification(
    notif_id:     uuid.UUID,
    payload:      NotificationActionRequest,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Execute inline action (approve/reject) on an actionable notification."""
    result = await db.execute(
        select(Notification).where(
            Notification.id      == notif_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(404, "Notification not found")
    if notif.is_actioned:
        raise HTTPException(400, "Already actioned")
    if not notif.action_type:
        raise HTTPException(400, "This notification is not actionable")

    # Delegate to the right service
    if notif.action_entity_type == "leave" and notif.action_entity_id:
        from app.models.leave import Leave, LeaveStatus
        leave_res = await db.execute(select(Leave).where(Leave.id == notif.action_entity_id))
        leave = leave_res.scalar_one_or_none()
        if leave and leave.status == LeaveStatus.PENDING:
            new_status = LeaveStatus.APPROVED if payload.action == "approve" else LeaveStatus.REJECTED
            leave.status = new_status
            leave.reviewed_by = current_user.id
            leave.reviewed_at = datetime.now(timezone.utc)
            if payload.comment and new_status == LeaveStatus.REJECTED:
                leave.rejection_reason = payload.comment

    elif notif.action_entity_type == "expense" and notif.action_entity_id:
        from app.models.payroll import Expense, ExpenseStatus
        exp_res = await db.execute(select(Expense).where(Expense.id == notif.action_entity_id))
        expense = exp_res.scalar_one_or_none()
        if expense and expense.status == ExpenseStatus.PENDING:
            new_exp_status = ExpenseStatus.APPROVED if payload.action == "approve" else ExpenseStatus.REJECTED
            expense.status = new_exp_status
            expense.reviewed_by = current_user.id
            expense.reviewed_at = datetime.now(timezone.utc)
            if payload.comment and new_exp_status == ExpenseStatus.REJECTED:
                expense.reject_reason = payload.comment

    notif.is_actioned = True
    notif.is_read = True
    await db.commit()
    return {"ok": True, "action": payload.action}


@router.patch("/{notif_id}/read")
async def mark_read(
    notif_id:     uuid.UUID,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id      == notif_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()
    return {"ok": True}


@router.patch("/read-all")
async def mark_all_read(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    notifs = result.scalars().all()
    for n in notifs:
        n.is_read = True
    await db.commit()
    return {"updated": len(notifs)}


@router.delete("/clear-read")
async def clear_read_notifications(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete all read notifications older than 30 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    result = await db.execute(
        delete(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == True,
            Notification.created_at < cutoff,
        )
    )
    await db.commit()
    return {"deleted": result.rowcount}


# ── Helper used by other routers to push a notification ──────────────────────
async def push_notification(
    db:      AsyncSession,
    user_id: uuid.UUID,
    type_:   str,
    title:   str,
    message: str,
    link:    str = None,
    category: str = "general",
    action_type: str = None,
    action_entity_type: str = None,
    action_entity_id: uuid.UUID = None,
    priority: str = "normal",
):
    notif = Notification(
        user_id = user_id,
        type    = type_,
        title   = title,
        message = message,
        link    = link,
        category = category,
        action_type = action_type,
        action_entity_type = action_entity_type,
        action_entity_id = action_entity_id,
        priority = priority,
    )
    db.add(notif)
    await db.flush()   # get id without full commit
    # Push real-time via WebSocket
    await manager.send_to_user(str(user_id), {
        "id":         str(notif.id),
        "type":       type_,
        "title":      title,
        "message":    message,
        "link":       link,
        "is_read":    False,
        "category":   category,
        "action_type": action_type,
        "priority":   priority,
    })
