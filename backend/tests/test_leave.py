"""
Backend integration tests — Leave management
Run: pytest backend/tests/test_leave.py -v
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_list_leaves_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/leaves/")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_apply_leave_unauthenticated(client: AsyncClient):
    resp = await client.post("/api/leaves/", json={
        "leave_type": "casual",
        "start_date": "2025-06-01",
        "end_date":   "2025-06-03",
        "reason":     "vacation",
    })
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_review_requires_manager_role(client: AsyncClient):
    """Non-manager token should be forbidden."""
    resp = await client.patch(
        "/api/leaves/00000000-0000-0000-0000-000000000001/review",
        json={"status": "approved"},
        headers={"Authorization": "Bearer employee-token"},
    )
    # Either 401 (invalid token) or 403 (insufficient role)
    assert resp.status_code in (401, 403)
