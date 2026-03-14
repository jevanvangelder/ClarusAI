from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Only create engine if DATABASE_URL is provided
if settings.DATABASE_URL:
    # Check if it's SQLite
    connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
    
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base = declarative_base()
else:
    # No database configured (using Supabase instead)
    engine = None
    SessionLocal = None
    Base = declarative_base()

def get_db():
    """Get database session (only works if DATABASE_URL is configured)"""
    if SessionLocal is None:
        raise RuntimeError("Database not configured. Use Supabase API instead.")
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()