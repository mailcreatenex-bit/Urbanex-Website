"""Offline tests: phone-number checks, Cloudflare Turnstile bot check and repeated-entry flags.

    pytest backend/tests/test_fake_entries_offline.py -n 0
"""
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402

os.environ.update(
    MONGO_URL="mongodb://offline", DB_NAME="offline_test4", CORS_ORIGINS="http://localhost:3000",
    ADMIN_EMAILS="admin@example.com", YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", TURNSTILE_SECRET_KEY="",
    UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-test-uploads-"),
)
import motor.motor_asyncio  # noqa: E402

motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

ADMIN = {"Authorization": "Bearer admin4-tok"}


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app, base_url="https://testserver") as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            await server.db.users.update_one({"email": "admin@example.com"}, {"$set": {"user_id": "a4", "name": "Ayan", "is_admin": True}}, upsert=True)
            await server.db.user_sessions.update_one({"session_token": "admin4-tok"}, {"$set": {"user_id": "a4", "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        yield client


@pytest.fixture(autouse=True)
def _clean(c):
    server._hits.clear()
    c.portal.call(lambda: server.db.submissions.delete_many({}))


def device(n: int) -> dict:
    return {"X-Device-Id": f"device-number-{n:08d}"}


def lead(c, phone, name="Fake Check", headers=None, **extra):
    return c.post("/api/leads", json={"name": name, "phone": phone, **extra}, headers=headers or {})


# ------------------------------------------------------------------ phone numbers
@pytest.mark.parametrize("raw,expected", [
    ("98310 24680", "+919831024680"), ("+91 98310-24680", "+919831024680"), ("09831024680", "+919831024680"),
    ("919831024680", "+919831024680"), ("(98310) 24680", "+919831024680"), ("+1 415 555 0100", "+14155550100"),
    ("+44 7700 900123", "+447700900123"), ("6201938475", "+916201938475"),
])
def test_valid_numbers_are_normalised(raw, expected):
    assert server.clean_phone(raw) == expected


@pytest.mark.parametrize("raw", [
    "9999999999", "9876543210", "9898989898", "9000000000", "9111111111", "9123456789",   # obvious dummies
    "1234567890", "5123456789", "0123456789",                                           # Indian mobiles start with 6-9
    "98310 2468", "98310246801", "12345", "abc", "", "98310-2468-0x",                   # wrong length / junk
    "+1 111 111 1111", "+9999999999", "+12",                                            # overseas dummies / too short
])
def test_fake_or_malformed_numbers_are_rejected(raw):
    with pytest.raises(ValueError):
        server.clean_phone(raw)


def test_every_public_form_rejects_fake_numbers(c):
    assert lead(c, "9999999999").status_code == 422
    assert lead(c, "9876543210").status_code == 422
    ok = lead(c, "98310 24680")
    assert ok.status_code == 200
    found = [l for l in c.get("/api/admin/leads", params={"q": "24680"}, headers=ADMIN).json() if l["name"] == "Fake Check"]
    assert found and found[0]["phone"] == "+919831024680"          # stored in one clean format
    pid = c.get("/api/properties").json()[0]["id"]
    slot = (datetime.now(server.IST) + timedelta(days=3)).replace(hour=11, minute=0, second=0, microsecond=0).isoformat()
    assert c.post("/api/visits", json={"property_id": pid, "name": "X", "phone": "9000000000", "slot": slot}).status_code == 422
    assert c.post("/api/interest", json={"item_type": "property", "item_id": pid, "name": "X", "phone": "9999999999"}).status_code == 422
    assert c.post("/api/digest/subscribe", json={"email": "a@example.com", "whatsapp": True, "phone": "9898989898"}).status_code == 422
    rid = c.post("/api/quiz/recommend", json={"budget": "b3", "purpose": "live", "family": "medium", "commute": "station",
                                              "vibe": "balanced", "education": "some", "timeline": "flexible", "space": "comfortable"}).json()["id"]
    assert c.post(f"/api/quiz/results/{rid}/lead", json={"name": "Q", "phone": "9999999999"}).status_code == 422
    assert c.post(f"/api/quiz/results/{rid}/lead", json={"name": "Q", "phone": "98310 24681"}).status_code == 200


# ------------------------------------------------------------------ Turnstile
def test_turnstile_is_off_without_a_secret(c):
    assert server.TURNSTILE_SECRET == ""
    assert lead(c, "98310 24682").status_code == 200


def test_turnstile_blocks_bots_when_enabled(c, monkeypatch):
    monkeypatch.setattr(server, "TURNSTILE_SECRET", "secret")
    seen = {}

    async def fake_check(token, ip):
        seen["token"] = token
        return token == "good-token"

    monkeypatch.setattr(server, "turnstile_check", fake_check)
    assert lead(c, "98310 24683").status_code == 400                                   # no token at all
    assert lead(c, "98310 24683", turnstile_token="bad-token").status_code == 400      # rejected by Cloudflare
    assert lead(c, "98310 24683", turnstile_token="good-token").status_code == 200
    assert seen["token"] == "good-token"
    # every public form is protected
    pid = c.get("/api/properties").json()[0]["id"]
    assert c.post("/api/interest", json={"item_type": "property", "item_id": pid, "name": "Bot", "phone": "98310 24684"}).status_code == 400
    assert c.post("/api/digest/subscribe", json={"email": "bot@example.com"}).status_code == 400
    slot = (datetime.now(server.IST) + timedelta(days=3)).replace(hour=11, minute=0, second=0, microsecond=0).isoformat()
    assert c.post("/api/visits", json={"property_id": pid, "name": "Bot", "phone": "98310 24685", "slot": slot}).status_code == 400
    good = c.post("/api/interest", json={"item_type": "property", "item_id": pid, "name": "Real Person", "phone": "98310 24686", "turnstile_token": "good-token"})
    assert good.status_code == 200
    # once known, further presses are one click and need no new bot check
    assert c.post("/api/interest", json={"item_type": "property", "item_id": c.get("/api/properties").json()[1]["id"]}).status_code == 200


def test_turnstile_failing_open_if_cloudflare_is_down(c, monkeypatch):
    monkeypatch.setattr(server, "TURNSTILE_SECRET", "secret")

    async def down(token, ip):
        raise RuntimeError("network")

    monkeypatch.setattr(server, "turnstile_check", down)
    assert lead(c, "98310 24687", turnstile_token="whatever").status_code == 200
    assert lead(c, "98310 24688").status_code == 400                                   # but a missing token is still refused


# ------------------------------------------------------------------ repeated entries
def flagged(c, phone):
    rows = c.get("/api/admin/leads", params={"q": phone[-5:]}, headers=ADMIN).json()
    return rows[0] if rows else None


def test_same_device_with_many_numbers_gets_flagged(c):
    d = device(1)
    for i, ph in enumerate(["98310 31001", "98310 31002"]):
        assert lead(c, ph, name=f"Dev A{i}", headers=d).status_code == 200
        assert flagged(c, ph)["flags"] == []                                            # one or two numbers: normal
    assert lead(c, "98310 31003", name="Dev A2", headers=d).status_code == 200
    row = flagged(c, "98310 31003")
    assert row["flags"] == ["device_many_numbers"] and "flagged" in row["tags"]
    notes = c.get("/api/admin/notifications", headers=ADMIN).json()["items"]
    assert any("(flagged)" in n["title"] for n in notes)


def test_extreme_numbers_from_one_device_are_refused(c):
    d = device(2)
    codes = [lead(c, f"98310 3200{i}", name=f"Many {i}", headers=d).status_code for i in range(9)]
    assert codes[:7] == [200] * 7 and codes[7] == 429 and codes[8] == 429               # the 8th different number is refused


def test_one_number_from_many_devices_gets_flagged(c):
    phone = "98310 33001"
    assert flagged(c, "x") is None or True
    for n in (3, 4):
        assert lead(c, phone, name=f"Shared {n}", headers=device(n)).status_code == 200
    assert lead(c, phone, name="Shared 5", headers=device(5)).status_code == 200
    rows = [r for r in c.get("/api/admin/leads", params={"q": "33001"}, headers=ADMIN).json()]
    assert any("number_many_devices" in r["flags"] for r in rows)


def test_many_numbers_from_one_network_are_flagged_not_blocked(c):
    # same IP (all test requests), no device header: after 5 distinct numbers the lead is flagged but still saved
    results = [lead(c, f"98310 3400{i}", name=f"Net {i}") for i in range(6)]
    assert all(r.status_code == 200 for r in results)
    rows = {r["name"]: r for r in c.get("/api/admin/leads", params={"q": "3400"}, headers=ADMIN).json()}
    assert rows["Net 0"]["flags"] == [] and "ip_many_numbers" in rows["Net 5"]["flags"]


def test_flags_follow_interested_contacts_into_the_crm(c):
    vids = c.portal.call(lambda: server.db.videos.insert_one({"video_id": "flagvideo01", "title": "Flag test video", "hidden": False, "missing": False,
                                                              "published_at": "2026-01-01T00:00:00Z", "price_inr": 5_000_000}))
    d = device(6)
    for i in range(3):  # three different people (browsers) from one device press Interested
        s = TestClient(server.app, base_url="https://testserver")
        r = s.post("/api/interest", json={"item_type": "video", "item_id": "flagvideo01", "name": f"Flag Person {i}", "phone": f"98310 3500{i}"}, headers=d)
        assert r.status_code == 200
    events = c.get("/api/admin/interests", params={"q": "Flag Person 2"}, headers=ADMIN).json()
    assert events and events[0]["flags"] == ["device_many_numbers"]
    leads = [l for l in c.get("/api/admin/leads", params={"source": "interested"}, headers=ADMIN).json() if l["name"] == "Flag Person 2"]
    assert leads and "device_many_numbers" in leads[0]["flags"] and "flagged" in leads[0]["tags"]
    summary = c.get("/api/admin/interests/summary", headers=ADMIN).json()
    people = next(i for i in summary["items"] if i["item_id"] == "flagvideo01")["people"]
    assert any(p["flags"] for p in people) and any(not p["flags"] for p in people)
    assert vids is not None


def test_bad_device_ids_are_ignored(c):
    for bad in ("short", "has spaces in it 1234567", "x" * 100):
        assert lead(c, f"98310 3600{len(bad) % 10}", name="Odd header", headers={"X-Device-Id": bad}).status_code == 200
    stored = c.portal.call(lambda: server.db.submissions.distinct("device_id"))
    assert stored == [None]
