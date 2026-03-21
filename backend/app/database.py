from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings
import re


def _build_engine_url(url: str) -> str:
    """
    SQLAlchemy с psycopg (v3) требует 'postgresql+psycopg://...' вместо 'postgresql://'.
    Также Render/Supabase возвращают URL с 'postgres://', заменяем на 'postgresql+psycopg://'.
    """
    url = re.sub(r'^postgres://', 'postgresql+psycopg://', url)
    url = re.sub(r'^postgresql://', 'postgresql+psycopg://', url)
    return url


engine = create_engine(
    _build_engine_url(settings.DATABASE_URL),
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
