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


class LeavePolicyCreate(BaseModel):
    name:           str
    days_per_year:  int
    carry_forward:  bool = False
    max_carry_days: int  = 0
    is_paid:        bool = True


class LeavePolicyUpdate(BaseModel):
    name:           Optional[str]  = None
    days_per_year:  Optional[int]  = None
    carry_forward:  Optional[bool] = None
    max_carry_days: Optional[int]  = None
    is_paid:        Optional[bool] = None


class LeavePolicyOut(BaseModel):
    id:             UUID4
    name:           str
    days_per_year:  int
    carry_forward:  bool
    max_carry_days: int
    is_paid:        bool
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
