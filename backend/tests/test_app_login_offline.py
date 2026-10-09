"""One-time sign-in tokens for the phone app.
    pytest backend/tests/test_app_login_offline.py -n 0"""
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_applogin", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="", TURNSTILE_SECRET_KEY="",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-al-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

ADMIN = {"Authorization": "Bearer al-admin"}


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            await server.db.users.update_one({"email": "admin@example.com"}, {"$set": {"user_id": "ala", "name": "Ayan", "is_admin": True}}, upsert=True)
            await server.db.user_sessions.update_one({"session_token": "al-admin"}, {"$set": {"user_id": "ala", "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        yield client


@pytest.fixture(autouse=True)
def fresh_limits():
    server._hits.clear()


def test_a_token_needs_a_signed_in_person(c):
    assert c.post("/api/auth/app-token").status_code == 401


def test_the_token_works_once_and_gives_a_session_cookie(c):
    t = c.post("/api/auth/app-token", headers=ADMIN).json()["token"]
    r = c.post("/api/auth/app-exchange", json={"token": t})
    assert r.status_code == 200 and r.json()["is_admin"] is True
    cookie = r.headers["set-cookie"]
    assert "session_token=" in cookie and "HttpOnly" in cookie and "Secure" in cookie
    sess = cookie.split("session_token=")[1].split(";")[0]
    me = TestClient(server.app).get("/api/auth/me", cookies={"session_token": sess})
    assert me.status_code == 200 and me.json()["email"] == "admin@example.com"
    again = c.post("/api/auth/app-exchange", json={"token": t})
    assert again.status_code == 401                                   # a second try with the same token fails


def test_expired_and_made_up_tokens_are_refused(c):
    t = c.post("/api/auth/app-token", headers=ADMIN).json()["token"]
    import hashlib
    c.portal.call(lambda: server.db.app_tokens.update_one({"hash": hashlib.sha256(t.encode()).hexdigest()}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)}}))
    assert c.post("/api/auth/app-exchange", json={"token": t}).status_code == 401
    assert c.post("/api/auth/app-exchange", json={"token": "x" * 43}).status_code == 401
    assert c.post("/api/auth/app-exchange", json={"token": "short"}).status_code == 422


def test_guessing_tokens_is_limited(c):
    codes = [c.post("/api/auth/app-exchange", json={"token": f"{i:0>43}"}).status_code for i in range(25)]
    assert 429 in codes
