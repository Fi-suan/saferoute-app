import os
import sys

# Override DB to sqlite for local tests since we removed PostGIS!
os.environ["DATABASE_URL"] = "sqlite:///./test_saferoute.db"

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine

# Ensure tables exist
Base.metadata.create_all(bind=engine)

client = TestClient(app)

def run_tests():
    print("--- Starting Backend Tests ---")
    
    # 1. Health check
    res = client.get("/")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("[OK] Health check passed")

    # 2. Add an Incident (Fake Location)
    res = client.post("/api/v1/incidents/report", json={
        "device_id": "test_device_1",
        "incident_type": "animal",
        "description": "Лошади на дороге!",
        "severity": 4,
        "latitude": 51.95,
        "longitude": 74.21,
        "timestamp": "2023-10-27T12:00:00Z",
        "photo_base64": None
    })
    assert res.status_code == 201, f"Incident report failed: {res.text}"
    incident_id = res.json()["id"]
    print("[OK] Incident reported")

    # 3. Retrieve Active Incidents
    res = client.get("/api/v1/incidents/active")
    assert res.status_code == 200
    data = res.json()
    assert len(data) > 0
    print("[OK] Active Incidents retrieved")

    # 4. Trigger Simulator Tick
    res = client.post("/api/v1/simulator/tick")
    assert res.status_code == 200, f"Simulator tick failed: {res.text}"
    print("[OK] Simulator tick passed")

    # 5. Geozones
    res = client.get("/api/v1/geozones/geojson")
    assert res.status_code == 200
    print("[OK] Geozones GeoJSON retrieved")

    # 6. Simulator status
    res = client.get("/api/v1/simulator/status")
    assert res.status_code == 200
    print("[OK] Simulator status checked")

    print("\n[SUCCESS] ALL TESTS PASSED. The pure-Python logic works.")

if __name__ == "__main__":
    run_tests()
