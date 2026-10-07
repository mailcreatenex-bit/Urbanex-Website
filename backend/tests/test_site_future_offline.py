"""Vastu Compass, map data and the voice concierge (no network, no AI key).
    pytest backend/tests/test_site_future_offline.py -n 0"""
import os
import sys
import tempfile
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_future", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="", TURNSTILE_SECRET_KEY="",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-future-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import server  # noqa: E402
import site_future  # noqa: E402


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        yield client


def test_good_layout_scores_high():
    r = site_future.check_layout("E", {"kitchen": ["SE"], "master_bedroom": ["SW"], "pooja": ["NE"], "entrance": ["NE"], "toilet": ["NW"]})
    assert r["score"] == 100 and r["grade"] == "Excellent" and r["must_fix"] == []


def test_bad_layout_names_the_problem_and_the_fix():
    r = site_future.check_layout("S", {"kitchen": ["NE"], "pooja": ["SW"], "toilet": ["NE"], "master_bedroom": ["SW"]})
    assert r["score"] < 50
    k = next(i for i in r["must_fix"] if i["room"] == "kitchen")
    assert k["verdict"] == "wrong" and "South-East" in k["fix"]


def test_centre_must_stay_open():
    r = site_future.check_layout(None, {"toilet": ["C"]})
    assert r["items"][0]["verdict"] == "wrong" and "centre open" in r["items"][0]["fix"].lower()


def test_check_endpoint(c):
    r = c.post("/api/vastu/check", json={"facing": "N", "rooms": {"kitchen": ["SE"], "bedroom": ["W", "NW"]}})
    assert r.status_code == 200 and r.json()["checked"] == 3 and r.json()["facing_note"]
    assert c.post("/api/vastu/check", json={"rooms": {}}).status_code == 422
    assert c.post("/api/vastu/check", json={"rooms": {"jacuzzi": ["N"]}}).status_code == 422
    assert c.post("/api/vastu/check", json={"rooms": {"kitchen": ["UP"]}}).status_code == 422


def test_photo_needs_ai(c):
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 64
    r = c.post("/api/vastu/photo", files={"file": ("plan.png", png, "image/png")})
    assert r.status_code == 503


def test_photo_is_read_by_the_ai_and_cleaned(c, monkeypatch):
    monkeypatch.setattr(server, "gemini_enabled", lambda: True)

    async def fake(prompt, system=None, **kw):
        return {"text": '{"north_found": true, "facing": "E", "rooms": [{"room": "kitchen", "direction": "SE"}, {"room": "ghost", "direction": "N"}, {"room": "pooja", "direction": "XX"}], "unclear": ["stairs"]}'}
    monkeypatch.setattr(server, "gemini_call", fake)
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 64
    r = c.post("/api/vastu/photo", files={"file": ("plan.png", png, "image/png")})
    assert r.status_code == 200
    assert r.json()["rooms"] == {"kitchen": ["SE"]} and r.json()["facing"] == "E" and r.json()["unclear"] == ["stairs"]


def test_vastu_lead_lands_in_the_crm(c):
    r = c.post("/api/vastu/lead", json={"name": "Vastu Seeker", "phone": "9831012399", "score": 42, "facing": "S", "problems": ["Kitchen in North-East"]})
    assert r.status_code == 200 and r.json()["id"]
    assert c.post("/api/vastu/lead", json={"name": "A", "phone": "123"}).status_code == 422


def test_map_data_has_zones_and_pins(c):
    d = c.get("/api/map/data").json()
    assert d["center"] == [23.235, 87.865]
    assert all(z["lat"] and z["lng"] for z in d["zones"])
    assert all("price_inr" not in p for p in d["properties"])


def test_concierge_understands_a_wish(c):
    r = c.post("/api/concierge", json={"text": "3 bhk flat near Goda under 60 lakh"})
    assert r.status_code == 200
    u = r.json()["understood"]
    assert u["bedrooms"] == 3 and u["zone"] == "Goda" and u["max_budget_inr"] == 6_000_000
    assert "price_inr" not in str(r.json()["properties"])
    assert r.json()["url"].startswith("/properties?")


def test_concierge_bengali_reply_and_rent(c):
    r = c.post("/api/concierge", json={"text": "বর্ধমানে ২ বিএইচকে ভাড়া"})
    assert r.status_code == 200 and r.json()["language"] == "bn" and r.json()["understood"].get("listing_type") == "rent"


def test_concierge_rejects_empty(c):
    assert c.post("/api/concierge", json={"text": " "}).status_code in (200, 422)
    assert c.post("/api/concierge", json={"text": "x"}).status_code == 422
