from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path

# Get the backend directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    APP_NAME: str = "ClarusAI"
    DEBUG: bool = True
    
    # OpenAI
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-mini"
    
    # Database (optional - alleen nodig voor oude chat endpoint)
    DATABASE_URL: Optional[str] = None
    
    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    
    # CORS (voor frontend later)
    CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:8000"]
    
    class Config:
        env_file = str(ENV_FILE)
        env_file_encoding = 'utf-8'
        case_sensitive = True

# Print voor debugging (we verwijderen dit straks)
print(f"Looking for .env file at: {ENV_FILE}")
print(f".env file exists: {ENV_FILE.exists()}")

# Global settings instance
settings = Settings()