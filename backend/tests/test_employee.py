"""
Backend integration tests — Employee (User) CRUD
Tests creating an employee with ALL fields and verifying every field is persisted.

Run: pytest tests/test_employee.py -v
Requires the real database (uses the same DB as the app).
"""
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.database import AsyncSessionLocal
from app.models.user import User, Department, Role
from app.utils.security import hash_password, create_access_token


# ── Helpers ──────────────────────────────────────────────────────────────────

def _admin_headers(user_id: str) -> dict:
    """Create a valid admin JWT and return auth headers."""
    token = create_access_token({"sub": user_id, "role": "super_admin"})
    return {"Authorization": f"Bearer {token}"}


def _emp_headers(user_id: str) -> dict:
    token = create_access_token({"sub": user_id, "role": "employee"})
    return {"Authorization": f"Bearer {token}"}


async def _ensure_admin() -> User:
    """Get or create a super_admin user for tests."""
    async with AsyncSessionLocal() as db:
        email = "testadmin_emp_crud@test.com"
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                employee_id=str(uuid.uuid4()),
                first_name="Test",
                last_name="Admin",
                email=email,
                hashed_password=hash_password("Admin@1234"),
                role=Role.SUPER_ADMIN,
                is_active=True,
                must_change_password=False,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        return user


async def _create_department() -> Department:
    async with AsyncSessionLocal() as db:
        dept = Department(
            name=f"TestDept_{uuid.uuid4().hex[:6]}",
            description="Test department",
            type="IT",
        )
        db.add(dept)
        await db.commit()
        await db.refresh(dept)
        return dept


async def _create_manager() -> User:
    async with AsyncSessionLocal() as db:
        user = User(
            employee_id=str(uuid.uuid4()),
            first_name="Manager",
            last_name="Test",
            email=f"testmgr_{uuid.uuid4().hex[:6]}@test.com",
            hashed_password=hash_password("Mgr@1234"),
            role=Role.MANAGER,
            is_active=True,
            must_change_password=False,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


async def _cleanup_user(user_id):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            await db.delete(user)
            await db.commit()


async def _cleanup_dept(dept_id):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Department).where(Department.id == dept_id))
        dept = result.scalar_one_or_none()
        if dept:
            await db.delete(dept)
            await db.commit()


# ── 1. Create employee with ALL fields → verify every field saved ────────────

@pytest.mark.asyncio
async def test_create_employee_all_fields_saved():
    """Create an employee with every field and verify each one is persisted."""
    admin = await _ensure_admin()
    dept = await _create_department()
    mgr = await _create_manager()
    headers = _admin_headers(str(admin.id))

    unique = uuid.uuid4().hex[:8]
    emp_id = str(uuid.uuid4())
    email = f"rahul.sharma.{unique}@test.com"

    payload = {
        "employee_id": emp_id,
        "first_name": "Rahul",
        "last_name": "Sharma",
        "email": email,
        "phone": "9876543210",
        "role": "employee",
        "designation": "Senior Software Engineer",
        "date_of_joining": "2026-03-18T00:00:00",
        "date_of_birth": "1998-05-20",
        "salary": 85000.00,
        "hra": 12000.00,
        "allowances": 5000.00,
        "bank_account": "9876543210123456",
        "ifsc_code": "HDFC0001234",
        "employment_type": "full_time",
        "work_location": "office",
        "password": "Test@12345",
        "department_id": str(dept.id),
        "manager_id": str(mgr.id),
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # ── CREATE ──
        resp = await client.post("/api/users/", json=payload, headers=headers)
        assert resp.status_code == 201, f"Create failed: {resp.text}"
        data = resp.json()

        # Verify response fields
        assert data["employee_id"] == emp_id
        assert data["first_name"] == "Rahul"
        assert data["last_name"] == "Sharma"
        assert data["email"] == email
        assert data["phone"] == "9876543210"
        assert data["role"] == "employee"
        assert data["designation"] == "Senior Software Engineer"
        assert float(data["salary"]) == 85000.00
        assert data["department_id"] == str(dept.id)
        assert data["manager_id"] == str(mgr.id)
        assert data["is_active"] is True
        assert data["must_change_password"] is True
        assert data["id"] is not None

        created_id = data["id"]

        # ── GET back and verify ──
        resp2 = await client.get(f"/api/users/{created_id}", headers=headers)
        assert resp2.status_code == 200
        fetched = resp2.json()

        assert fetched["employee_id"] == emp_id
        assert fetched["first_name"] == "Rahul"
        assert fetched["last_name"] == "Sharma"
        assert fetched["email"] == email
        assert fetched["phone"] == "9876543210"
        assert fetched["role"] == "employee"
        assert fetched["designation"] == "Senior Software Engineer"
        assert float(fetched["salary"]) == 85000.00
        assert fetched["department_id"] == str(dept.id)
        assert fetched["manager_id"] == str(mgr.id)
        assert fetched["is_active"] is True
        assert fetched["full_name"] == "Rahul Sharma"
        assert fetched["department_name"] == dept.name

    # ── Verify directly in DB ──
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == uuid.UUID(created_id)))
        user = result.scalar_one_or_none()
        assert user is not None
        assert user.first_name == "Rahul"
        assert user.last_name == "Sharma"
        assert user.email == email
        assert user.phone == "9876543210"
        assert user.role == Role.EMPLOYEE
        assert user.designation == "Senior Software Engineer"
        assert float(user.salary) == 85000.00
        assert float(user.hra) == 12000.00
        assert float(user.allowances) == 5000.00
        assert user.bank_account == "9876543210123456"
        assert user.ifsc_code == "HDFC0001234"
        assert str(user.date_of_birth) == "1998-05-20"
        assert user.employment_type == "full_time"
        assert user.work_location == "office"
        assert user.department_id == dept.id
        assert user.manager_id == mgr.id
        assert user.is_active is True
        assert user.must_change_password is True

    # Cleanup
    await _cleanup_user(uuid.UUID(created_id))
    await _cleanup_user(mgr.id)
    await _cleanup_dept(dept.id)


# ── 2. Duplicate email is rejected ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_employee_duplicate_email_rejected():
    """Creating two employees with the same email should fail."""
    admin = await _ensure_admin()
    headers = _admin_headers(str(admin.id))
    email = f"dup_{uuid.uuid4().hex[:8]}@test.com"

    payload = {
        "employee_id": str(uuid.uuid4()),
        "first_name": "Dup",
        "last_name": "Test",
        "email": email,
        "password": "Test@12345",
        "role": "employee",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp1 = await client.post("/api/users/", json=payload, headers=headers)
        assert resp1.status_code == 201
        created_id = resp1.json()["id"]

        # Second attempt — same email, different employee_id
        payload["employee_id"] = str(uuid.uuid4())
        resp2 = await client.post("/api/users/", json=payload, headers=headers)
        assert resp2.status_code == 400
        assert "already registered" in resp2.json()["detail"].lower()

        # Cleanup
        await client.delete(f"/api/users/{created_id}", headers=headers)


# ── 3. No auth token → rejected ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_employee_without_auth_rejected():
    """Creating an employee without a token should return 401/403."""
    payload = {
        "employee_id": str(uuid.uuid4()),
        "first_name": "No",
        "last_name": "Auth",
        "email": "noauth@test.com",
        "password": "Test@12345",
        "role": "employee",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/users/", json=payload)
        assert resp.status_code in (401, 403)


# ── 4. Employee role cannot create employees ─────────────────────────────────

@pytest.mark.asyncio
async def test_employee_role_cannot_create_employee():
    """An employee-role user should not be able to create new employees."""
    async with AsyncSessionLocal() as db:
        emp = User(
            employee_id=str(uuid.uuid4()),
            first_name="Regular",
            last_name="Employee",
            email=f"emp_{uuid.uuid4().hex[:8]}@test.com",
            hashed_password=hash_password("Emp@1234"),
            role=Role.EMPLOYEE,
            is_active=True,
            must_change_password=False,
        )
        db.add(emp)
        await db.commit()
        await db.refresh(emp)
        emp_id = emp.id

    headers = _emp_headers(str(emp_id))

    payload = {
        "employee_id": str(uuid.uuid4()),
        "first_name": "Should",
        "last_name": "Fail",
        "email": f"fail_{uuid.uuid4().hex[:8]}@test.com",
        "password": "Test@12345",
        "role": "employee",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/users/", json=payload, headers=headers)
        assert resp.status_code == 403

    await _cleanup_user(emp_id)


# ── 5. Update employee → verify all fields saved ────────────────────────────

@pytest.mark.asyncio
async def test_update_employee_all_fields_saved():
    """Update an employee's editable fields and verify they persist."""
    admin = await _ensure_admin()
    headers = _admin_headers(str(admin.id))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create first
        email = f"update_{uuid.uuid4().hex[:8]}@test.com"
        resp = await client.post("/api/users/", json={
            "employee_id": str(uuid.uuid4()),
            "first_name": "Before",
            "last_name": "Update",
            "email": email,
            "password": "Test@12345",
            "role": "employee",
        }, headers=headers)
        assert resp.status_code == 201
        user_id = resp.json()["id"]

        # Update with ALL editable fields
        update_payload = {
            "first_name": "After",
            "last_name": "Updated",
            "phone": "1234567890",
            "designation": "Tech Lead",
            "salary": 120000.00,
            "hra": 15000.00,
            "allowances": 5000.00,
            "bank_account": "1234567890123456",
            "ifsc_code": "SBIN0001234",
            "date_of_birth": "1995-06-15",
            "address": "123 Test Street, Bangalore",
            "emergency_contact": "9999888877",
            "employment_type": "full_time",
            "work_location": "hybrid",
            "role": "manager",
        }
        resp2 = await client.patch(f"/api/users/{user_id}", json=update_payload, headers=headers)
        assert resp2.status_code == 200, f"Update failed: {resp2.text}"
        updated = resp2.json()

        assert updated["first_name"] == "After"
        assert updated["last_name"] == "Updated"
        assert updated["phone"] == "1234567890"
        assert updated["designation"] == "Tech Lead"
        assert float(updated["salary"]) == 120000.00
        assert updated["role"] == "manager"

        # GET and verify
        resp3 = await client.get(f"/api/users/{user_id}", headers=headers)
        fetched = resp3.json()
        assert fetched["full_name"] == "After Updated"

    # Verify in DB
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one()
        assert user.first_name == "After"
        assert user.last_name == "Updated"
        assert user.phone == "1234567890"
        assert user.designation == "Tech Lead"
        assert float(user.salary) == 120000.00
        assert float(user.hra) == 15000.00
        assert float(user.allowances) == 5000.00
        assert user.bank_account == "1234567890123456"
        assert user.ifsc_code == "SBIN0001234"
        assert str(user.date_of_birth) == "1995-06-15"
        assert user.address == "123 Test Street, Bangalore"
        assert user.emergency_contact == "9999888877"
        assert user.employment_type == "full_time"
        assert user.work_location == "hybrid"
        assert user.role == Role.MANAGER

    await _cleanup_user(uuid.UUID(user_id))


# ── 6. Missing required fields → 422 ────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_employee_missing_required_fields():
    """Missing required fields should return 422."""
    admin = await _ensure_admin()
    headers = _admin_headers(str(admin.id))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Missing first_name
        resp = await client.post("/api/users/", json={
            "employee_id": str(uuid.uuid4()),
            "last_name": "Test",
            "email": "missing@test.com",
            "password": "Test@12345",
        }, headers=headers)
        assert resp.status_code == 422

        # Missing email
        resp = await client.post("/api/users/", json={
            "employee_id": str(uuid.uuid4()),
            "first_name": "Test",
            "last_name": "Test",
            "password": "Test@12345",
        }, headers=headers)
        assert resp.status_code == 422

        # Missing password
        resp = await client.post("/api/users/", json={
            "employee_id": str(uuid.uuid4()),
            "first_name": "Test",
            "last_name": "Test",
            "email": "nopwd@test.com",
        }, headers=headers)
        assert resp.status_code == 422


# ── 7. Create with only required fields → optional fields are null ───────────

@pytest.mark.asyncio
async def test_create_employee_minimal_fields():
    """Create employee with only required fields — optional should be null."""
    admin = await _ensure_admin()
    headers = _admin_headers(str(admin.id))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/users/", json={
            "employee_id": str(uuid.uuid4()),
            "first_name": "Minimal",
            "last_name": "User",
            "email": f"minimal_{uuid.uuid4().hex[:8]}@test.com",
            "password": "Test@12345",
        }, headers=headers)
        assert resp.status_code == 201
        data = resp.json()

        assert data["phone"] is None
        assert data["designation"] is None
        assert data["salary"] is None
        assert data["department_id"] is None
        assert data["manager_id"] is None
        assert data["role"] == "employee"   # default
        assert data["is_active"] is True    # default

        await client.delete(f"/api/users/{data['id']}", headers=headers)


# ── 8. GET by ID + 404 for nonexistent ───────────────────────────────────────

@pytest.mark.asyncio
async def test_get_employee_by_id():
    """Fetch a specific employee by ID, and 404 for nonexistent."""
    admin = await _ensure_admin()
    headers = _admin_headers(str(admin.id))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/users/", json={
            "employee_id": str(uuid.uuid4()),
            "first_name": "Fetch",
            "last_name": "ById",
            "email": f"getbyid_{uuid.uuid4().hex[:8]}@test.com",
            "phone": "5555555555",
            "password": "Test@12345",
            "designation": "QA Engineer",
        }, headers=headers)
        assert resp.status_code == 201
        user_id = resp.json()["id"]

        # GET — found
        resp2 = await client.get(f"/api/users/{user_id}", headers=headers)
        assert resp2.status_code == 200
        assert resp2.json()["first_name"] == "Fetch"
        assert resp2.json()["phone"] == "5555555555"
        assert resp2.json()["designation"] == "QA Engineer"

        # GET — not found
        resp3 = await client.get(f"/api/users/{uuid.uuid4()}", headers=headers)
        assert resp3.status_code == 404

        await client.delete(f"/api/users/{user_id}", headers=headers)


# ── 9. Search employees ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_employees_search():
    """Search employees by unique name and verify result."""
    admin = await _ensure_admin()
    headers = _admin_headers(str(admin.id))
    unique = uuid.uuid4().hex[:8]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/users/", json={
            "employee_id": str(uuid.uuid4()),
            "first_name": f"Searchable{unique}",
            "last_name": "Person",
            "email": f"search_{unique}@test.com",
            "password": "Test@12345",
        }, headers=headers)
        assert resp.status_code == 201
        user_id = resp.json()["id"]

        # Search by unique name
        resp2 = await client.get(f"/api/users/?search=Searchable{unique}", headers=headers)
        assert resp2.status_code == 200
        data = resp2.json()
        users = data.get("users", data) if isinstance(data, dict) else data
        found = [u for u in users if u["id"] == user_id]
        assert len(found) == 1
        assert found[0]["first_name"] == f"Searchable{unique}"

        await client.delete(f"/api/users/{user_id}", headers=headers)


# ── 10. Delete employee ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_employee():
    """Delete an employee and verify they are gone."""
    admin = await _ensure_admin()
    headers = _admin_headers(str(admin.id))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/users/", json={
            "employee_id": str(uuid.uuid4()),
            "first_name": "Delete",
            "last_name": "Me",
            "email": f"del_{uuid.uuid4().hex[:8]}@test.com",
            "password": "Test@12345",
        }, headers=headers)
        assert resp.status_code == 201
        user_id = resp.json()["id"]

        # Delete
        del_resp = await client.delete(f"/api/users/{user_id}", headers=headers)
        assert del_resp.status_code == 204

        # Verify 404
        get_resp = await client.get(f"/api/users/{user_id}", headers=headers)
        assert get_resp.status_code == 404

    # Verify gone in DB
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        assert result.scalar_one_or_none() is None


# ── 11. Department assignment persists ───────────────────────────────────────

@pytest.mark.asyncio
async def test_employee_department_assignment():
    """Assign department during creation and verify it's reflected."""
    admin = await _ensure_admin()
    dept = await _create_department()
    headers = _admin_headers(str(admin.id))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/users/", json={
            "employee_id": str(uuid.uuid4()),
            "first_name": "Dept",
            "last_name": "Test",
            "email": f"depttest_{uuid.uuid4().hex[:8]}@test.com",
            "password": "Test@12345",
            "department_id": str(dept.id),
        }, headers=headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["department_id"] == str(dept.id)
        assert data["department_name"] == dept.name

        await client.delete(f"/api/users/{data['id']}", headers=headers)

    await _cleanup_dept(dept.id)


# ── 12. Manager assignment persists ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_employee_manager_assignment():
    """Assign a reporting manager and verify the relationship is saved."""
    admin = await _ensure_admin()
    mgr = await _create_manager()
    headers = _admin_headers(str(admin.id))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/users/", json={
            "employee_id": str(uuid.uuid4()),
            "first_name": "Managed",
            "last_name": "Employee",
            "email": f"mgrtest_{uuid.uuid4().hex[:8]}@test.com",
            "password": "Test@12345",
            "manager_id": str(mgr.id),
        }, headers=headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["manager_id"] == str(mgr.id)

        user_id = data["id"]

    # Verify in DB
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one()
        assert user.manager_id == mgr.id

    await _cleanup_user(uuid.UUID(user_id))
    await _cleanup_user(mgr.id)
