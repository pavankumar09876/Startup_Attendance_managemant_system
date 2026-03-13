"""
Backend integration tests — Attendance
Run: pytest backend/tests/test_attendance.py -v
"""
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock

from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
def auth_headers():
    """Mock auth headers — replace with real token in CI."""
    return {"Authorization": "Bearer test-token"}


@pytest.mark.asyncio
async def test_list_attendance_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/attendance/")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_summary_requires_auth(client: AsyncClient):
    resp = await client.get("/api/attendance/summary/00000000-0000-0000-0000-000000000001?month=1&year=2025")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_check_in_unauthenticated(client: AsyncClient):
    resp = await client.post("/api/attendance/check-in")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_check_out_unauthenticated(client: AsyncClient):
    resp = await client.post("/api/attendance/check-out")
    assert resp.status_code in (401, 403)
