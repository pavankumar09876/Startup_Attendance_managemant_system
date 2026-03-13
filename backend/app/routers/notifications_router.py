"""Notifications router — /api/notifications + WebSocket /ws/notifications"""
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, List
import asyncio
import json
import uuid

from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationOut
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
    skip:         int  = Query(0, ge=0),
    limit:        int  = Query(20, ge=1, le=100),
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        q = q.where(Notification.is_read == False)
    q = q.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/unread-count")
async def unread_count(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import func
    count = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )).scalar()
    return {"count": count}


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


# ── Helper used by other routers to push a notification ──────────────────────
async def push_notification(
    db:      AsyncSession,
    user_id: uuid.UUID,
    type_:   str,
    title:   str,
    message: str,
    link:    str = None,
):
    from app.models.notification import NotificationType
    notif = Notification(
        user_id = user_id,
        type    = type_,
        title   = title,
        message = message,
        link    = link,
    )
    db.add(notif)
    await db.flush()   # get id without full commit
    # Push real-time
    await manager.send_to_user(str(user_id), {
        "id":         str(notif.id),
        "type":       type_,
        "title":      title,
        "message":    message,
        "link":       link,
        "is_read":    False,
    })
