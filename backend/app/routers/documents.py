"""Documents router — /api/documents"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from typing import Optional
import os
import uuid

from app.database import get_db
from app.models.document import Document
from app.models.user import User, Role
from app.utils.dependencies import get_current_user, require_roles
from pydantic import BaseModel, UUID4

router = APIRouter(prefix="/documents", tags=["Documents"])

ADMIN_ROLES = (Role.SUPER_ADMIN, Role.ADMIN, Role.HR)


class DocumentOut(BaseModel):
    id:            UUID4
    employee_id:   UUID4
    document_type: str
    filename:      str
    file_path:     str
    notes:         Optional[str] = None
    verified:      bool
    verified_by:   Optional[UUID4] = None
    verified_at:   Optional[datetime] = None
    created_at:    datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=list[DocumentOut])
async def list_documents(
    employee_id:  Optional[uuid.UUID] = None,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Document)
    if current_user.role == Role.EMPLOYEE:
        q = q.where(Document.employee_id == current_user.id)
    elif employee_id:
        q = q.where(Document.employee_id == employee_id)
    q = q.order_by(Document.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=DocumentOut, status_code=201)
async def upload_document(
    employee_id:   uuid.UUID = Form(...),
    document_type: str       = Form("other"),
    notes:         Optional[str] = Form(None),
    file:          UploadFile = File(...),
    db:            AsyncSession = Depends(get_db),
    current_user:  User = Depends(get_current_user),
):
    # Employees can only upload their own documents
    if current_user.role == Role.EMPLOYEE and employee_id != current_user.id:
        raise HTTPException(403, "Forbidden")

    ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.txt', '.webp'}
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

    safe_filename = os.path.basename(file.filename or 'document')
    ext = os.path.splitext(safe_filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type '{ext}' not allowed. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large. Maximum size is 10MB.")

    upload_dir = "uploads/documents"
    os.makedirs(upload_dir, exist_ok=True)
    stored   = f"{uuid.uuid4()}{ext}"
    path     = os.path.join(upload_dir, stored)
    try:
        with open(path, "wb") as f:
            f.write(content)
    except OSError as e:
        raise HTTPException(500, f"Failed to save file: {e}")

    doc = Document(
        employee_id   = employee_id,
        document_type = document_type,
        filename      = file.filename or stored,
        file_path     = f"/uploads/documents/{stored}",
        notes         = notes,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.patch("/{doc_id}/verify", response_model=DocumentOut)
async def verify_document(
    doc_id:       uuid.UUID,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_ROLES)),
):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc    = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    doc.verified    = True
    doc.verified_by = current_user.id
    doc.verified_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    doc_id:       uuid.UUID,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc    = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    if current_user.role == Role.EMPLOYEE and doc.employee_id != current_user.id:
        raise HTTPException(403, "Forbidden")
    # Remove file from disk
    disk_path = doc.file_path.lstrip("/")
    try:
        if os.path.exists(disk_path):
            os.remove(disk_path)
    except OSError:
        pass  # Continue with DB deletion even if file removal fails
    await db.delete(doc)
    await db.commit()
