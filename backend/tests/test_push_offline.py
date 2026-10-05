"""Offline tests for Web Push: subscriptions, keys, admin sends and automatic alerts.

    pytest backend/tests/test_push_offline.py -n 0
"""
import asyncio
import json
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402

os.environ.update(
    MONGO_URL="mongodb://offline", DB_NAME="offline_test5", CORS_ORIGINS="http://localhost:3000",
    ADMIN_EMAILS="admin@example.com", YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="",
    TURNSTILE_SECRET_KEY="", VAPID_PUBLIC_KEY="", VAPID_PRIVATE_KEY="", UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-test-uploads-"),
)
import motor.motor_asyncio  # noqa: E402

motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

ADMIN = {"Authorization": "Bearer admin5-tok"}


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            await server.db.users.update_one({"email": "admin@example.com"}, {"$set": {"user_id": "a5", "name": "Ayan", "is_admin": True}}, upsert=True)
            await server.db.user_sessions.update_one({"session_token": "admin5-tok"}, {"$set": {"user_id": "a5", "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        yield client


@pytest.fixture(autouse=True)
def _clean(c):
    server._hits.clear()
    c.portal.call(lambda: server.db.push_subs.delete_many({}))
    c.portal.call(lambda: server.db.push_log.delete_many({}))


def sub(n=1, host="https://fcm.googleapis.com/fcm/send/"):
    return {"subscription": {"endpoint": f"{host}token-{n:04d}-abcdefghijklmnop", "keys": {"p256dh": "B" + "x" * 86, "auth": "y" * 22}}}


@pytest.fixture()
def delivered(monkeypatch):
    sent = []

    async def fake(s, data, keys):
        sent.append((s["endpoint"], json.loads(data)))
        return "gone" if s["endpoint"].endswith("-0003-abcdefghijklmnop") else "ok"

    monkeypatch.setattr(server, "push_one", fake)
    return sent


def settle(c):
    c.portal.call(lambda: asyncio.sleep(0.3))   # let background alert tasks finish


def test_vapid_keys_are_generated_once_and_valid(c):
    k1 = c.get("/api/push/key").json()["public_key"]
    assert len(k1) == 87 and k1 == c.get("/api/push/key").json()["public_key"]       # stable across calls
    keys = c.portal.call(server.vapid_keys)
    from cryptography.hazmat.primitives import serialization as ser
    from py_vapid import Vapid
    v = Vapid.from_string(keys["private"])                                           # the stored private key loads...
    assert server._b64url(v.public_key.public_bytes(ser.Encoding.X962, ser.PublicFormat.UncompressedPoint)) == keys["public"] == k1   # ...and matches


def test_subscribe_validation_and_dedupe(c):
    assert c.post("/api/push/subscribe", json=sub(1)).status_code == 200
    assert c.post("/api/push/subscribe", json=sub(1)).status_code == 200            # same endpoint: updated, not duplicated
    assert c.post("/api/push/subscribe", json=sub(2)).status_code == 200
    assert c.portal.call(lambda: server.db.push_subs.count_documents({})) == 2
    bad = sub(5)
    bad["subscription"]["endpoint"] = "http://insecure.example/abc-abcdefghijkl"
    assert c.post("/api/push/subscribe", json=bad).status_code == 422                # https only
    assert c.post("/api/push/subscribe", json={"subscription": {"endpoint": "https://x.example/aaaaaaaaaaaaaaaa", "keys": {}}}).status_code == 422
    assert c.post("/api/push/unsubscribe", json={"endpoint": sub(2)["subscription"]["endpoint"]}).status_code == 200
    assert c.portal.call(lambda: server.db.push_subs.count_documents({})) == 1


def test_admin_send_reaches_everyone_and_prunes_expired(c, delivered):
    for n in (1, 2, 3):
        c.post("/api/push/subscribe", json=sub(n))
    assert c.post("/api/admin/push/send", json={"title": "Hi", "body": "Hello"}).status_code == 401
    r = c.post("/api/admin/push/send", json={"title": "New flat in Goda", "body": "Tap to see it", "url": "/videos"}, headers=ADMIN)
    assert r.status_code == 200
    assert r.json() == {"subscribers": 3, "sent": 2, "failed": 0, "removed": 1}      # the expired one was removed
    assert len(delivered) == 3 and delivered[0][1]["title"] == "New flat in Goda" and delivered[0][1]["url"] == "/videos"
    assert c.portal.call(lambda: server.db.push_subs.count_documents({})) == 2
    info = c.get("/api/admin/push", headers=ADMIN).json()
    assert info["subscribers"] == 2 and info["recent"][0]["title"] == "New flat in Goda"
    assert c.post("/api/admin/push/send", json={"title": "x", "body": "y", "url": "javascript:alert(1)"}, headers=ADMIN).status_code == 422
    assert c.post("/api/admin/push/send", json={"title": "x", "body": "y", "url": "https://evil.example/x"}, headers=ADMIN).status_code == 422   # same-site links only


def test_test_send_only_goes_to_the_admins_devices(c, delivered):
    c.post("/api/push/subscribe", json=sub(1))                                      # anonymous visitor
    c.post("/api/push/subscribe", json=sub(2), headers=ADMIN)                       # admin's own device
    r = c.post("/api/admin/push/send", json={"title": "Test", "body": "Only me", "test": True}, headers=ADMIN)
    assert r.json()["sent"] == 1 and len(delivered) == 1 and delivered[0][0].endswith("-0002-abcdefghijklmnop")


def test_new_listing_triggers_an_auto_alert_that_can_be_switched_off(c, delivered):
    c.post("/api/push/subscribe", json=sub(1))
    body = {"title": "TEST Auto Alert Flat", "zone": "Kalibazar", "property_type": "apartment", "area_sqft": 900,
            "price_inr": 4_000_000, "description": "d", "image": "https://example.com/a.jpg"}
    assert c.post("/api/admin/properties", json=body, headers=ADMIN).status_code == 200
    settle(c)
    assert delivered and delivered[-1][1]["title"] == "New listing" and "4000000" not in json.dumps(delivered[-1][1])   # never a price
    assert c.put("/api/admin/push/auto", json={"auto": False}, headers=ADMIN).json()["auto"] is False
    n = len(delivered)
    c.post("/api/admin/properties", json={**body, "title": "TEST Silent Flat"}, headers=ADMIN)
    settle(c)
    assert len(delivered) == n
    c.put("/api/admin/push/auto", json={"auto": True}, headers=ADMIN)


FEED = """<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <entry><yt:videoId>PUSHVIDEO01</yt:videoId><title>Brand new 3BHK tour</title><published>2026-10-06T09:00:00+00:00</published></entry>{extra}</feed>"""
EXTRA = "<entry><yt:videoId>PUSHVIDEO02</yt:videoId><title>Second upload</title><published>2026-10-07T09:00:00+00:00</published></entry>"


def test_first_import_never_pushes_but_a_later_upload_does(c, delivered, monkeypatch):
    state = {"xml": FEED.format(extra="")}

    async def fake_rss(url):
        return state["xml"]

    monkeypatch.setattr(server, "rss_get", fake_rss)
    c.post("/api/push/subscribe", json=sub(1))
    c.portal.call(lambda: server.db.videos.delete_many({}))
    first = c.portal.call(server.sync_youtube)                                      # first import into an empty catalogue
    settle(c)
    assert first["new"] == 1 and not delivered
    state["xml"] = FEED.format(extra=EXTRA)
    second = c.portal.call(server.sync_youtube)
    settle(c)
    assert second["new"] == 1 and delivered and delivered[-1][1]["title"] == "New video tour" and "Second upload" in delivered[-1][1]["body"]
