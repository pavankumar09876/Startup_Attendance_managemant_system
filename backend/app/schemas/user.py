from pydantic import BaseModel, EmailStr, UUID4
from typing import Optional
from datetime import datetime
from decimal import Decimal
from app.models.user import Role


class DepartmentBase(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentOut(DepartmentBase):
    id: UUID4
    created_at: datetime

    class Config:
        from_attributes = True


class UserBase(BaseModel):
    employee_id: str
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    role: Role = Role.EMPLOYEE
    department_id: Optional[UUID4] = None
    designation: Optional[str] = None
    date_of_joining: Optional[datetime] = None
    salary: Optional[Decimal] = None
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[Role] = None
    department_id: Optional[UUID4] = None
    designation: Optional[str] = None
    salary: Optional[Decimal] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None


class UserOut(UserBase):
    id: UUID4
    is_active: bool
    created_at: datetime
    department: Optional[DepartmentOut] = None

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ChangePassword(BaseModel):
    current_password: str
    new_password: str
