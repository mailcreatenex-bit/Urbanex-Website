"""The keep-alive loop only runs when KEEPALIVE_URL is set and asks for the server's own front page.
    pytest backend/tests/test_keepalive_offline.py -n 0"""
import asyncio
import os
import sys
import tempfile
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_keepalive", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", GEMINI_API_KEY="", TURNSTILE_SECRET_KEY="", UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-ka-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402,F401
import keepalive  # noqa: E402


def test_loop_does_nothing_without_an_address(monkeypatch):
    monkeypatch.setattr(keepalive, "KEEPALIVE_URL", "")
    asyncio.run(asyncio.wait_for(keepalive.keepalive_loop(), 2))           # returns at once


def test_loop_pings_the_front_page_and_survives_errors(monkeypatch):
    seen = []

    async def fake_ping(url):
        seen.append(url)
        if len(seen) == 1:
            raise RuntimeError("host busy")
        return 200
    monkeypatch.setattr(keepalive, "KEEPALIVE_URL", "https://example.onrender.com")
    monkeypatch.setattr(keepalive, "ping_once", fake_ping)
    real_sleep = asyncio.sleep
    calls = {"n": 0}

    async def quick_sleep(secs):
        calls["n"] += 1
        if calls["n"] > 3:
            raise asyncio.CancelledError
        await real_sleep(0)
    monkeypatch.setattr(keepalive.asyncio, "sleep", quick_sleep)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(keepalive.keepalive_loop())
    assert seen[:2] == ["https://example.onrender.com", "https://example.onrender.com"]
