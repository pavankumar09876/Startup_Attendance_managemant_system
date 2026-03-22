from sqlalchemy import Column, String, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class DocumentType:
    OFFER_LETTER = "offer_letter"
    ID_PROOF     = "id_proof"
    CERTIFICATE  = "certificate"
    NDA          = "nda"
    PAN_CARD     = "pan_card"
    AADHAAR      = "aadhaar"
    BANK_PROOF   = "bank_proof"
    EDUCATION    = "education"
    EXPERIENCE   = "experience"
    ADDRESS_PROOF = "address_proof"
    PHOTO        = "photo"
    OTHER        = "other"


class Document(Base):
    __tablename__ = "documents"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    document_type  = Column(String(50), nullable=False, default="other")
    filename       = Column(String(300), nullable=False)
    file_path      = Column(String(500), nullable=False)
    notes          = Column(Text, nullable=True)
    verified       = Column(Boolean, default=False)
    verified_by    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at    = Column(DateTime(timezone=True), nullable=True)
    is_required    = Column(Boolean, default=False)
    expiry_date    = Column(Date, nullable=True)
    requirement_id = Column(UUID(as_uuid=True), ForeignKey("document_requirements.id", ondelete="SET NULL"), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    employee    = relationship("User", foreign_keys=[employee_id])
    verifier    = relationship("User", foreign_keys=[verified_by])
    requirement = relationship("DocumentRequirement", foreign_keys=[requirement_id])
