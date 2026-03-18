from pydantic import BaseModel, UUID4
from typing import Optional, List, Dict, Any
from datetime import datetime


class CompanySettingsOut(BaseModel):
    id:              UUID4
    name:            str
    logo_url:        Optional[str] = None
    industry:        Optional[str] = None
    size:            Optional[str] = None
    founded_year:    Optional[int] = None
    address:         Optional[str] = None
    city:            Optional[str] = None
    state:           Optional[str] = None
    country:         Optional[str] = None
    timezone:        str
    working_days:    List[int]
    work_start_time: str
    work_end_time:   str
    admin_ip_whitelist: List[str] = []

    class Config:
        from_attributes = True


class CompanySettingsUpdate(BaseModel):
    name:            Optional[str]       = None
    industry:        Optional[str]       = None
    size:            Optional[str]       = None
    founded_year:    Optional[int]       = None
    address:         Optional[str]       = None
    city:            Optional[str]       = None
    state:           Optional[str]       = None
    country:         Optional[str]       = None
    timezone:        Optional[str]       = None
    working_days:    Optional[List[int]] = None
    work_start_time: Optional[str]       = None
    work_end_time:   Optional[str]       = None
    admin_ip_whitelist: Optional[List[str]] = None


class AttendanceConfigOut(BaseModel):
    id:                       UUID4
    grace_period_minutes:     int
    half_day_threshold_hours: float
    overtime_after_hours:     float
    geofence_radius_meters:   int
    office_lat:               Optional[float] = None
    office_lng:               Optional[float] = None
    allow_wfh:                bool
    require_selfie:           bool
    auto_mark_absent:         bool
    auto_absent_after_time:   str
    checkin_reminder_time:    str
    checkout_reminder_time:   str
    # Penalty config
    late_penalty_enabled:     bool = False
    late_penalty_amount:      Optional[float] = 0
    late_penalty_type:        str = "fixed"
    absent_penalty_enabled:   bool = False
    absent_penalty_days:      Optional[float] = 1
    half_day_deduction_enabled: bool = False
    half_day_deduction_amount:  Optional[float] = 0
    max_late_days_before_deduction: int = 3

    class Config:
        from_attributes = True


class AttendanceConfigUpdate(BaseModel):
    grace_period_minutes:     Optional[int]   = None
    half_day_threshold_hours: Optional[float] = None
    overtime_after_hours:     Optional[float] = None
    geofence_radius_meters:   Optional[int]   = None
    office_lat:               Optional[float] = None
    office_lng:               Optional[float] = None
    allow_wfh:                Optional[bool]  = None
    require_selfie:           Optional[bool]  = None
    auto_mark_absent:         Optional[bool]  = None
    auto_absent_after_time:   Optional[str]   = None
    checkin_reminder_time:    Optional[str]   = None
    checkout_reminder_time:   Optional[str]   = None
    late_penalty_enabled:     Optional[bool]  = None
    late_penalty_amount:      Optional[float] = None
    late_penalty_type:        Optional[str]   = None
    absent_penalty_enabled:   Optional[bool]  = None
    absent_penalty_days:      Optional[float] = None
    half_day_deduction_enabled: Optional[bool]  = None
    half_day_deduction_amount:  Optional[float] = None
    max_late_days_before_deduction: Optional[int] = None


class LeavePolicyCreate(BaseModel):
    name:           str
    days_per_year:  int
    carry_forward:  bool = False
    max_carry_days: int  = 0
    is_paid:        bool = True
    sandwich_rule:  bool = False
    allow_half_day: bool = True
    allow_negative_balance: bool = False
    max_negative_days: float = 0
    encashment_allowed: bool = False
    encashment_max_days: Optional[int] = None
    accrual_type:   str = "yearly"
    monthly_accrual_amount: Optional[float] = None
    probation_days_before_eligible: int = 0


class LeavePolicyUpdate(BaseModel):
    name:           Optional[str]  = None
    days_per_year:  Optional[int]  = None
    carry_forward:  Optional[bool] = None
    max_carry_days: Optional[int]  = None
    is_paid:        Optional[bool] = None
    sandwich_rule:  Optional[bool] = None
    allow_half_day: Optional[bool] = None
    allow_negative_balance: Optional[bool] = None
    max_negative_days: Optional[float] = None
    encashment_allowed: Optional[bool] = None
    encashment_max_days: Optional[int] = None
    accrual_type:   Optional[str]  = None
    monthly_accrual_amount: Optional[float] = None
    probation_days_before_eligible: Optional[int] = None


class LeavePolicyOut(BaseModel):
    id:             UUID4
    name:           str
    days_per_year:  int
    carry_forward:  bool
    max_carry_days: int
    is_paid:        bool
    sandwich_rule:  bool = False
    allow_half_day: bool = True
    allow_negative_balance: bool = False
    max_negative_days: float = 0
    encashment_allowed: bool = False
    encashment_max_days: Optional[int] = None
    accrual_type:   str = "yearly"
    monthly_accrual_amount: Optional[float] = None
    probation_days_before_eligible: int = 0
    created_at:     datetime

    class Config:
        from_attributes = True


class ModulePermissions(BaseModel):
    view:    bool = False
    create:  bool = False
    edit:    bool = False
    delete:  bool = False
    approve: bool = False


class RolePermissionsOut(BaseModel):
    role:        str
    permissions: Dict[str, ModulePermissions]


class RolePermissionsUpdate(BaseModel):
    permissions: Dict[str, ModulePermissions]


class NotificationPrefOut(BaseModel):
    leave_approved_email:             bool
    leave_approved_inapp:             bool
    leave_rejected_email:             bool
    leave_rejected_inapp:             bool
    task_assigned_email:              bool
    task_assigned_inapp:              bool
    payslip_ready_email:              bool
    payslip_ready_inapp:              bool
    attendance_regularization_inapp:  bool
    project_deadline_email:           bool
    project_deadline_inapp:           bool
    birthday_reminder_inapp:          bool
    checkin_reminder_inapp:           bool
    checkout_reminder_inapp:          bool

    class Config:
        from_attributes = True


class NotificationPrefUpdate(BaseModel):
    leave_approved_email:             Optional[bool] = None
    leave_approved_inapp:             Optional[bool] = None
    leave_rejected_email:             Optional[bool] = None
    leave_rejected_inapp:             Optional[bool] = None
    task_assigned_email:              Optional[bool] = None
    task_assigned_inapp:              Optional[bool] = None
    payslip_ready_email:              Optional[bool] = None
    payslip_ready_inapp:              Optional[bool] = None
    attendance_regularization_inapp:  Optional[bool] = None
    project_deadline_email:           Optional[bool] = None
    project_deadline_inapp:           Optional[bool] = None
    birthday_reminder_inapp:          Optional[bool] = None
    checkin_reminder_inapp:           Optional[bool] = None
    checkout_reminder_inapp:          Optional[bool] = None
