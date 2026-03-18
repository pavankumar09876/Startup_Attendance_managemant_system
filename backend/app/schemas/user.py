from pydantic import BaseModel, EmailStr, UUID4, field_validator, model_validator
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
from app.models.user import Role, EmployeeStatus


class DepartmentBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: Optional[str] = "Other"          # IT, Non-IT, Other
    head_id: Optional[UUID4] = None

    @field_validator('head_id', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v

    @field_validator('description', mode='before')
    @classmethod
    def empty_desc_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    head_id: Optional[UUID4] = None

    @field_validator('head_id', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v


class DepartmentOut(DepartmentBase):
    id: UUID4
    head_name: Optional[str] = None
    employee_count: int = 0
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
    hra: Optional[Decimal] = None
    allowances: Optional[Decimal] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    employment_type: Optional[str] = None
    work_location: Optional[str] = None
    avatar_url: Optional[str] = None
    manager_id: Optional[UUID4] = None
    approval_limit: Optional[Decimal] = None

    @field_validator('department_id', 'manager_id', mode='before')
    @classmethod
    def empty_uuid_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v

    @field_validator('phone', 'designation', 'bank_account', 'ifsc_code',
                     'address', 'emergency_contact', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v

    @field_validator('date_of_birth', 'date_of_joining', mode='before')
    @classmethod
    def empty_date_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v


class UserCreate(UserBase):
    password: str
    send_welcome_email: bool = False


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role: Optional[Role] = None
    department_id: Optional[UUID4] = None
    designation: Optional[str] = None
    manager_id: Optional[UUID4] = None
    date_of_joining: Optional[datetime] = None
    salary: Optional[Decimal] = None
    hra: Optional[Decimal] = None
    allowances: Optional[Decimal] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    employment_type: Optional[str] = None
    work_location: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    status: Optional[EmployeeStatus] = None
    termination_date: Optional[date] = None
    termination_reason: Optional[str] = None
    suspension_reason: Optional[str] = None

    @field_validator('department_id', 'manager_id', mode='before')
    @classmethod
    def empty_uuid_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v

    @field_validator('phone', 'designation', 'bank_account', 'ifsc_code',
                     'address', 'emergency_contact', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v

    @field_validator('date_of_birth', 'date_of_joining', mode='before')
    @classmethod
    def empty_date_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v


class UserOut(UserBase):
    id: UUID4
    is_active: bool
    status: Optional[EmployeeStatus] = EmployeeStatus.ACTIVE
    termination_date: Optional[date] = None
    must_change_password: bool = False
    manager_id: Optional[UUID4] = None
    manager_name: Optional[str] = None
    full_name: Optional[str] = None
    department_name: Optional[str] = None
    created_at: datetime
    department: Optional[DepartmentOut] = None

    class Config:
        from_attributes = True

    @model_validator(mode='after')
    def compute_fields(self):
        if not self.full_name:
            self.full_name = f"{self.first_name} {self.last_name}"
        if not self.department_name and self.department:
            self.department_name = self.department.name
        return self


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class SetFirstPassword(BaseModel):
    """Used on forced first-login password change (no current_password needed)."""
    new_password: str
