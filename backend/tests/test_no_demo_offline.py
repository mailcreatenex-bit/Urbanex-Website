"""A real site must not show sample data.   pytest backend/tests/test_no_demo_offline.py -n 0"""
import os
import sys
import tempfile
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402

import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_nodemo", CORS_ORIGINS="http://localhost:3000", YOUTUBE_API_KEY="",
                  YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="", UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-nd-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402


def test_no_sample_listings_and_old_ones_are_purged_but_real_ones_kept(monkeypatch):
    monkeypatch.delenv("SEED_DEMO_DATA", raising=False)
    seed = server.SEED_PROPERTIES[0]
    async def prep():
        await server.db.properties.insert_many([
            {"id": "demo1", "title": seed["title"], "image": server.PROP_IMGS[0]},
            {"id": "real1", "title": "My own plot in Goda", "image": "/uploads/x.jpg"},
            {"id": "real2", "title": seed["title"], "image": "/uploads/mine.jpg"},   # same title but own photo: kept
        ])
        await server.db.settings.delete_one({"_id": "demo_purged"})
    with TestClient(server.app) as c:
        c.portal.call(prep)
    with TestClient(server.app) as c:      # restart: purge runs once
        ids = {p["id"] for p in c.get("/api/properties").json()}
    assert {"real1", "real2"} <= ids and "demo1" not in ids
