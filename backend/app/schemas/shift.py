from pydantic import BaseModel, UUID4, field_validator
from typing import Optional
from datetime import datetime
import re


def _validate_hhmm(v: str) -> str:
    if not re.match(r'^\d{2}:\d{2}$', v):
        raise ValueError('Time must be in HH:MM format')
    return v


class ShiftCreate(BaseModel):
    name:           str
    start_time:     str
    end_time:       str
    grace_minutes:  int  = 10
    is_night_shift: bool = False

    @field_validator('start_time', 'end_time')
    @classmethod
    def check_hhmm(cls, v: str) -> str:
        return _validate_hhmm(v)


class ShiftUpdate(BaseModel):
    name:           Optional[str]  = None
    start_time:     Optional[str]  = None
    end_time:       Optional[str]  = None
    grace_minutes:  Optional[int]  = None
    is_night_shift: Optional[bool] = None
    is_active:      Optional[bool] = None

    @field_validator('start_time', 'end_time')
    @classmethod
    def check_hhmm(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return _validate_hhmm(v)
        return v


class ShiftOut(BaseModel):
    id:             UUID4
    name:           str
    start_time:     str
    end_time:       str
    grace_minutes:  int
    is_night_shift: bool
    is_active:      bool
    created_at:     datetime

    class Config:
        from_attributes = True
