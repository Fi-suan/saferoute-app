import os

# Override DB to sqlite for local tests
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

    # 2. Register device to get auth token
    res = client.post("/api/v1/devices/register", json={
        "device_id": "test_device_1",
        "role": "driver",
    })
    assert res.status_code in (200, 201), f"Device register failed: {res.text}"
    token = res.json().get("token", "")
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    print("[OK] Device registered")

    # 3. Add an Incident
    res = client.post("/api/v1/incidents/report", json={
        "incident_type": "animal",
        "description": "Лошади на дороге!",
        "severity": 4,
        "latitude": 51.95,
        "longitude": 74.21,
    }, headers=headers)
    assert res.status_code == 201, f"Incident report failed: {res.text}"
    incident_id = res.json()["id"]
    print("[OK] Incident reported")

    # 4. Retrieve Active Incidents
    res = client.get("/api/v1/incidents/active")
    assert res.status_code == 200
    data = res.json()
    assert len(data) > 0
    print("[OK] Active Incidents retrieved")

    # 5. Geozones
    res = client.get("/api/v1/geozones/geojson")
    assert res.status_code == 200
    print("[OK] Geozones GeoJSON retrieved")

    print("\n[SUCCESS] ALL TESTS PASSED.")

if __name__ == "__main__":
    run_tests()
