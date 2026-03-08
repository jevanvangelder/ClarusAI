"""
Legacy database module - redirects to new location.
All new code should import from app.core.database instead.
"""

from app.core.database import (
    engine,
    SessionLocal,
    Base,
    get_db
)

__all__ = ["engine", "SessionLocal", "Base", "get_db"]