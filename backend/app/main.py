"""
SafeRoute / Sapa Jol — FastAPI Application
"""
import json
import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import engine, Base, SessionLocal, get_db
from app.routers import herds, alerts, geozones, devices, incidents, auth
from app.services.simulator import simulator_tick, get_simulator_status, initialize_simulator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.add(ws)
        logger.info(f"WS connected, total: {len(self.active_connections)}")

    def disconnect(self, ws: WebSocket):
        self.active_connections.discard(ws)

    async def broadcast(self, data: dict):
        dead = set()
        for ws in self.active_connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        self.active_connections -= dead


ws_manager = ConnectionManager()
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized")

    db = SessionLocal()
    try:
        from app.seed import seed_geozones
        seed_geozones(db)
        initialize_simulator(db)
        logger.info("Geozones seeded and simulator initialized")
    finally:
        db.close()

    async def run_sim_tick():
        db = SessionLocal()
        try:
            result = simulator_tick(db)
            if ws_manager.active_connections:
                await ws_manager.broadcast({
                    "type": "tick",
                    "data": result,
                    "timestamp": datetime.utcnow().isoformat(),
                })
        except Exception as e:
            logger.error(f"Scheduler tick error: {e}")
        finally:
            db.close()

    scheduler.add_job(
        run_sim_tick,
        "interval",
        seconds=settings.SIMULATOR_INTERVAL_SECONDS,
        id="sim_tick",
    )
    scheduler.start()
    logger.info(f"Simulator started (interval: {settings.SIMULATOR_INTERVAL_SECONDS}s)")

    yield

    scheduler.shutdown()
    logger.info("Scheduler shut down")


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
    allow_methods=["GET", "POST", "DELETE"],
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


@app.websocket("/ws/live")
async def websocket_live(ws: WebSocket):
    """Real-time feed: herd positions + active alerts"""
    await ws_manager.connect(ws)
    try:
        db = SessionLocal()
        try:
            from app.models import Herd, Alert, HerdLocation
            herds_data = []
            for h in db.query(Herd).filter(Herd.is_active == True).all():
                loc = (
                    db.query(HerdLocation)
                    .filter(HerdLocation.herd_id == h.id)
                    .order_by(HerdLocation.timestamp.desc())
                    .first()
                )
                herds_data.append({
                    "id": h.id,
                    "name": h.name,
                    "animal_type": h.animal_type.value,
                    "estimated_count": h.estimated_count,
                    "lat": loc.latitude if loc else None,
                    "lon": loc.longitude if loc else None,
                })
            active_alerts = [
                {
                    "id": a.id,
                    "level": a.level.value,
                    "message_kk": a.message_kk,
                    "herd_id": a.herd_id,
                    "geozone_id": a.geozone_id,
                    "distance_to_road_km": a.distance_to_road_km,
                    "eta_minutes": a.estimated_arrival_minutes,
                }
                for a in db.query(Alert).filter(Alert.is_active == True).all()
            ]
            await ws.send_json({
                "type": "snapshot",
                "herds": herds_data,
                "alerts": active_alerts,
                "timestamp": datetime.utcnow().isoformat(),
            })
        finally:
            db.close()

        while True:
            await asyncio.sleep(30)
            await ws.send_json({"type": "ping", "ts": datetime.utcnow().isoformat()})

    except WebSocketDisconnect:
        ws_manager.disconnect(ws)


# ── Directions Proxy ─────────────────────────────────────────────────────────
@app.get("/api/v1/directions")
@limiter.limit(settings.RATE_LIMIT_DEFAULT)
async def proxy_directions(
    request: Request,
    origin_lat: float = Query(...),
    origin_lon: float = Query(...),
    dest_lat: float = Query(...),
    dest_lon: float = Query(...),
):
    """Proxy Google Directions API — keeps API key server-side."""
    if not settings.GOOGLE_MAPS_API_KEY:
        return {"error": "Google Maps API key not configured on server"}

    import httpx
    url = (
        f"https://maps.googleapis.com/maps/api/directions/json"
        f"?origin={origin_lat},{origin_lon}"
        f"&destination={dest_lat},{dest_lon}"
        f"&key={settings.GOOGLE_MAPS_API_KEY}"
        f"&language=ru&mode=driving"
    )
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        return resp.json()


# ── Simulator ────────────────────────────────────────────────────────────────
@app.post("/api/v1/simulator/tick")
def manual_tick(steps: int = 1, db: Session = Depends(get_db)):
    results = []
    for _ in range(min(steps, 50)):
        results.append(simulator_tick(db))
    return {"steps": steps, "results": results}


@app.get("/api/v1/simulator/status")
def sim_status():
    return get_simulator_status()


@app.post("/api/v1/simulator/reset")
def sim_reset(db: Session = Depends(get_db)):
    from app.services.simulator import reset_simulator
    reset_simulator(db)
    return {"status": "reset"}


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "time": datetime.utcnow().isoformat()}


@app.get("/")
def root():
    return {
        "name": "SafeRoute / Sapa Jol API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
