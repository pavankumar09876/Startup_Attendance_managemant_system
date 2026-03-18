"""
Data scoping layer — restricts query results based on the user's role.

Usage:
    from app.utils.scoping import scope_users, scope_query

    q = scope_users(select(User), current_user)
    q = scope_query(select(Attendance), current_user, employee_id_col=Attendance.employee_id)
"""
from sqlalchemy import Select

from app.models.user import User, Role


def scope_users(query: Select, current_user: User) -> Select:
    """
    Scope a User query based on the current user's role.
    - SUPER_ADMIN / ADMIN / HR  → all users
    - MANAGER                   → only direct reports + self
    - EMPLOYEE                  → only self
    """
    if current_user.role in (Role.SUPER_ADMIN, Role.ADMIN, Role.HR):
        return query
    if current_user.role == Role.MANAGER:
        from sqlalchemy import or_
        return query.where(
            or_(
                User.manager_id == current_user.id,
                User.id == current_user.id,
            )
        )
    # EMPLOYEE → self only
    return query.where(User.id == current_user.id)


def scope_query(query: Select, current_user: User, *, employee_id_col) -> Select:
    """
    Scope any query that has an employee_id column (attendance, leave, expenses, etc).
    - SUPER_ADMIN / ADMIN / HR  → all records
    - MANAGER                   → records of direct reports + self
    - EMPLOYEE                  → only own records

    For MANAGER scoping, the query must join User already or we add a subquery.
    """
    if current_user.role in (Role.SUPER_ADMIN, Role.ADMIN, Role.HR):
        return query
    if current_user.role == Role.MANAGER:
        from sqlalchemy import or_
        team_ids_subq = select(User.id).where(User.manager_id == current_user.id)
        return query.where(
            or_(
                employee_id_col == current_user.id,
                employee_id_col.in_(team_ids_subq),
            )
        )
    # EMPLOYEE
    return query.where(employee_id_col == current_user.id)


# Convenience import
from sqlalchemy import select
