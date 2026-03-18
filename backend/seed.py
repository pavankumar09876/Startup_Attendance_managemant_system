"""
Seed script — creates all tables from models and seeds default users.
Run once on a fresh database:  python seed.py
"""

import asyncio
from sqlalchemy import select, text

from app.config import settings
from app.database import Base, AsyncSessionLocal, engine
from app.models import *  # noqa: F401, F403  — register all models with Base
from app.models.user import User, Role
from app.models.permission import Permission, DefaultRolePermission, PERMISSIONS, ROLE_PERMISSIONS
from app.utils.security import hash_password


SEED_USERS = [
    {
        "employee_id": "SA-001",
        "first_name": "Super",
        "last_name": "Admin",
        "email": "superadmin@gmail.com",
        "role": Role.SUPER_ADMIN,
        "designation": "Super Administrator",
        "password": "Superadmin123$",
    },
    {
        "employee_id": "AD-001",
        "first_name": "Admin",
        "last_name": "User",
        "email": "admin@gmail.com",
        "role": Role.ADMIN,
        "designation": "Administrator",
        "password": "Admin123$",
    },
    {
        "employee_id": "MG-001",
        "first_name": "Manager",
        "last_name": "One",
        "email": "manager1@gmail.com",
        "role": Role.MANAGER,
        "designation": "Manager",
        "password": "Manager123$",
    },
    {
        "employee_id": "MG-002",
        "first_name": "Manager",
        "last_name": "Two",
        "email": "manager2@gmail.com",
        "role": Role.MANAGER,
        "designation": "Manager",
        "password": "Manager123$",
    },
]


async def create_tables():
    """Create all tables from SQLAlchemy models (safe — skips existing tables)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("All tables created (or already exist).")


async def stamp_alembic():
    """Stamp Alembic version table so future migrations work correctly."""
    async with engine.begin() as conn:
        await conn.execute(text(
            "CREATE TABLE IF NOT EXISTS alembic_version ("
            "  version_num VARCHAR(32) NOT NULL, "
            "  CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)"
            ")"
        ))
        await conn.execute(text("DELETE FROM alembic_version"))
        await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('0019')"))
    print("Alembic stamped to revision 0019.")


async def seed_users():
    """Create default seed users."""
    async with AsyncSessionLocal() as db:
        for data in SEED_USERS:
            result = await db.execute(
                select(User).where(User.email == data["email"])
            )
            if result.scalar_one_or_none():
                print(f"  SKIP  {data['email']} (already exists)")
                continue

            user = User(
                employee_id=data["employee_id"],
                first_name=data["first_name"],
                last_name=data["last_name"],
                email=data["email"],
                hashed_password=hash_password(data["password"]),
                role=data["role"],
                designation=data["designation"],
                is_active=True,
            )
            db.add(user)
            print(f"  CREATED  {data['email']}  ({data['role'].value})")

        await db.commit()


async def seed_permissions():
    """Seed permissions and role→permission mappings from the canonical map."""
    async with AsyncSessionLocal() as db:
        # 1. Seed Permission rows
        existing = (await db.execute(select(Permission.code))).scalars().all()
        existing_set = set(existing)
        created = 0
        for code, (module, action, description) in PERMISSIONS.items():
            if code not in existing_set:
                db.add(Permission(code=code, module=module, action=action, description=description))
                created += 1
        if created:
            await db.commit()
        print(f"  Permissions: {created} created, {len(existing_set)} already exist")

        # 2. Seed DefaultRolePermission rows
        existing_rp = (await db.execute(
            select(DefaultRolePermission.role, DefaultRolePermission.permission_code)
        )).all()
        existing_rp_set = set(existing_rp)
        rp_created = 0
        for role, perms in ROLE_PERMISSIONS.items():
            for perm_code in perms:
                if (role, perm_code) not in existing_rp_set:
                    db.add(DefaultRolePermission(role=role, permission_code=perm_code))
                    rp_created += 1
        if rp_created:
            await db.commit()
        print(f"  Role-Permission mappings: {rp_created} created, {len(existing_rp_set)} already exist")


async def main():
    print("=== Creating tables ===")
    await create_tables()

    print("\n=== Stamping Alembic ===")
    await stamp_alembic()

    print("\n=== Seeding users ===")
    await seed_users()

    print("\n=== Seeding permissions ===")
    await seed_permissions()

    print("\nDone! You can now start the server.")


if __name__ == "__main__":
    asyncio.run(main())
