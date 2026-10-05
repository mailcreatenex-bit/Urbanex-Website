"""Videos can be saved to the shortlist.   pytest backend/tests/test_shortlist_videos_offline.py -n 0"""
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_sl", CORS_ORIGINS="http://localhost:3000", YOUTUBE_API_KEY="",
                  YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="", UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-sl-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

U = {"Authorization": "Bearer sl-tok"}


def test_save_and_list_videos():
    with TestClient(server.app) as c:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            await server.db.users.update_one({"email": "sl@example.com"}, {"$set": {"user_id": "sl1", "name": "S"}}, upsert=True)
            await server.db.user_sessions.update_one({"session_token": "sl-tok"}, {"$set": {"user_id": "sl1", "expires_at": exp}}, upsert=True)
            for vid, hidden in (("vidAAAAAAA1", False), ("vidBBBBBBB2", False), ("vidHIDDEN03", True)):
                await server.db.videos.insert_one({"video_id": vid, "title": vid, "hidden": hidden, "published_at": "2026-01-01T00:00:00+00:00", "price_inr": 5000000})
        c.portal.call(seed)
        assert c.post("/api/me/watchlist/vidAAAAAAA1", headers=U).status_code == 200
        assert c.post("/api/me/watchlist/not-a-thing", headers=U).status_code == 404
        assert c.put("/api/me/watchlist", json={"ids": ["vidBBBBBBB2", "zzz"]}, headers=U).json()["ids"].__len__() == 2
        res = c.get("/api/video-listings", params={"ids": "vidAAAAAAA1,vidBBBBBBB2,vidHIDDEN03,bad id!", "limit": 100}).json()
        assert {i["video_id"] for i in res["items"]} == {"vidAAAAAAA1", "vidBBBBBBB2"}
        assert all("price_inr" not in i for i in res["items"])
