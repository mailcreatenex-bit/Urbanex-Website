"""Manually added listings (portal-style): optional price, photo and YouTube link; sale or rent.
    pytest backend/tests/test_manual_listings_offline.py -n 0"""
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_ml", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-ml-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

ADMIN = {"Authorization": "Bearer ml-admin"}
BASE = {"title": "Plot near GT Road", "zone": "Goda", "property_type": "plot", "area_sqft": 2160, "description": "Corner plot, 20 ft road."}


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            await server.db.users.update_one({"email": "admin@example.com"}, {"$set": {"user_id": "ml1", "name": "A", "is_admin": True}}, upsert=True)
            await server.db.user_sessions.update_one({"session_token": "ml-admin"}, {"$set": {"user_id": "ml1", "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        yield client


def test_listing_without_price_or_photo_but_with_a_youtube_link(c):
    r = c.post("/api/admin/properties", json={**BASE, "video_id": "https://youtu.be/dQw4w9WgXcQ?si=x"}, headers=ADMIN)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["video_id"] == "dQw4w9WgXcQ" and p["price_inr"] is None
    assert p["image"] == "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"            # the video thumbnail is the cover
    pub = c.get(f"/api/properties/{p['slug']}").json()
    assert pub["video_id"] == "dQw4w9WgXcQ" and "price_inr" not in pub                   # still no price in public data


def test_listing_with_nothing_optional_and_bad_link_rejected(c):
    r = c.post("/api/admin/properties", json=BASE, headers=ADMIN)
    assert r.status_code == 200 and r.json()["image"] == "" and r.json()["video_id"] is None
    bad = c.post("/api/admin/properties", json={**BASE, "title": "Bad link", "video_id": "https://example.com/watch?v=dQw4w9WgXcQ"}, headers=ADMIN)
    assert bad.status_code == 422


def test_rent_filter_and_edit_flow(c):
    rent = c.post("/api/admin/properties", json={**BASE, "title": "2BHK flat on rent", "property_type": "apartment", "bedrooms": 2, "listing_type": "rent",
                                                 "price_inr": 12000, "address": "Near DVC More", "facing": "south_east", "floor_info": "2nd of 4"}, headers=ADMIN).json()
    rents = {p["id"] for p in c.get("/api/properties", params={"listing_type": "rent"}).json()}
    sales = {p["id"] for p in c.get("/api/properties", params={"listing_type": "sale"}).json()}
    assert rent["id"] in rents and rent["id"] not in sales and sales
    # adding a video later, then price first set (no "price drop" from nothing), then the link removed
    up = c.patch(f"/api/admin/properties/{rent['id']}", json={"video_id": "dQw4w9WgXcQ"}, headers=ADMIN).json()
    assert up["video_id"] == "dQw4w9WgXcQ"
    nop = c.post("/api/admin/properties", json={**BASE, "title": "No price yet"}, headers=ADMIN).json()
    set_price = c.patch(f"/api/admin/properties/{nop['id']}", json={"price_inr": 2500000}, headers=ADMIN)
    assert set_price.status_code == 200 and not set_price.json().get("price_drop_at")
