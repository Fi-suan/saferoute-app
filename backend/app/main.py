"""
SafeRoute / Sapa Jol — FastAPI Application
"""
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Depends, Request, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import engine, Base, SessionLocal, get_db
from app.routers import herds, alerts, geozones, devices, incidents, auth

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized")

    db = SessionLocal()
    try:
        from app.seed import seed_geozones
        seed_geozones(db)
        logger.info("Geozones seeded")
    finally:
        db.close()

    yield


app = FastAPI(
    title="SafeRoute / Sapa Jol API",
    description="API мониторинга миграции животных и предотвращения ДТП на дорогах Казахстана",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Auth (public — no token required)
app.include_router(auth.router, prefix="/api/v1")

# Protected + public routes
app.include_router(herds.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(geozones.router, prefix="/api/v1")
app.include_router(devices.router, prefix="/api/v1")
app.include_router(incidents.router)  # already has /api/v1 prefix


# ── Directions Proxy ─────────────────────────────────────────────────────────
@app.get("/api/v1/directions")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def proxy_directions(
    request: Request,
    origin_lat: float = Query(..., ge=-90, le=90),
    origin_lon: float = Query(..., ge=-180, le=180),
    dest_lat: float = Query(..., ge=-90, le=90),
    dest_lon: float = Query(..., ge=-180, le=180),
):
    """Proxy Google Directions API — keeps API key server-side."""
    if not settings.GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=503, detail="Google Maps API key not configured")

    import httpx
    from urllib.parse import urlencode
    params = urlencode({
        "origin": f"{origin_lat},{origin_lon}",
        "destination": f"{dest_lat},{dest_lon}",
        "key": settings.GOOGLE_MAPS_API_KEY,
        "language": "ru",
        "mode": "driving",
    })
    url = f"https://maps.googleapis.com/maps/api/directions/json?{params}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        return resp.json()


@app.get("/health")
def health(db: Session = Depends(get_db)):
    from sqlalchemy import text
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    status = "ok" if db_ok else "degraded"
    return {"status": status, "db": db_ok, "app": settings.APP_NAME, "time": datetime.now(timezone.utc).isoformat()}


@app.get("/")
def root():
    return {
        "name": "SafeRoute / Sapa Jol API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
