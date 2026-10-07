"""Owner listings: 3 free days, UPI payment confirmed by hand, removal when unpaid.
    pytest backend/tests/test_owner_listings_offline.py -n 0"""
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_ol", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-ol-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

ADMIN = {"Authorization": "Bearer ol-admin"}
OWNER = {"Authorization": "Bearer ol-owner"}
OTHER = {"Authorization": "Bearer ol-other"}
BODY = {"title": "My plot in Borehat", "zone": "Borehat", "property_type": "plot", "area_sqft": 2400, "price_inr": 2800000,
        "description": "Clear title, 20 ft road.", "phone": "9830012345", "accepted_terms": True,
        "video_id": "https://youtu.be/dQw4w9WgXcQ"}


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            for uid, email, name, tok, admin in (("ola", "admin@example.com", "Ayan", "ol-admin", True), ("olo", "owner@example.com", "Sumit Banerjee", "ol-owner", False),
                                                 ("olx", "other@example.com", "Other Person", "ol-other", False)):
                await server.db.users.update_one({"email": email}, {"$set": {"user_id": uid, "name": name, "is_admin": admin}}, upsert=True)
                await server.db.user_sessions.update_one({"session_token": tok}, {"$set": {"user_id": uid, "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        yield client


def state(c, pid):
    return c.portal.call(lambda: server.db.properties.find_one({"id": pid}, {"_id": 0}))


def test_listings_open_by_default_and_can_be_switched_off_and_free_days_start(c):
    first = c.get("/api/listing-plans").json()
    assert first["accepting"] is True and first["can_pay"] is False          # free days work before any UPI details exist
    assert c.put("/api/admin/listing-settings", json={"accepting": False}, headers=ADMIN).status_code == 200
    assert c.get("/api/listing-plans").json()["accepting"] is False
    assert c.post("/api/owner/listings", json=BODY, headers=OWNER).status_code == 503
    assert c.put("/api/admin/listing-settings", json={"accepting": True}, headers=ADMIN).status_code == 200
    assert c.post("/api/owner/listings", json=BODY).status_code == 401
    bad = c.put("/api/admin/listing-settings", json={"upi_id": "not a upi"}, headers=ADMIN)
    assert bad.status_code == 422
    ok = c.put("/api/admin/listing-settings", json={"upi_id": "ayan@oksbi", "upi_name": "Ayan Dey", "plans": [
        {"id": "30", "days": 30, "amount": 499, "label": "30 days"}, {"id": "90", "days": 90, "amount": 999, "label": "90 days"}]}, headers=ADMIN)
    assert ok.status_code == 200
    pub = c.get("/api/listing-plans").json()
    assert pub["accepting"] is True and pub["can_pay"] is True and "upi_id" not in pub and pub["trial_days"] == 3
    assert c.get("/api/owner/payment-info").status_code == 401
    assert c.get("/api/owner/payment-info", headers=OWNER).json()["upi_id"] == "ayan@oksbi"


def test_listing_is_live_immediately_for_three_days_and_private_data_stays_private(c):
    assert c.post("/api/owner/listings", json={**BODY, "accepted_terms": False}, headers=OWNER).status_code == 422
    r = c.post("/api/owner/listings", json=BODY, headers=OWNER)
    assert r.status_code == 200, r.text
    mine = r.json()
    assert mine["listing_state"] == "trial" and mine["days_left"] in (2, 3) and mine["verified"] is False and mine["video_id"] == "dQw4w9WgXcQ"
    listed = c.get("/api/properties").json()
    row = [p for p in listed if p["id"] == mine["id"]][0]
    assert row["owner_listing"] is True and row["listed_by"] == "Sumit B."
    assert not set(row) & {"owner", "owner_user_id", "trial_ends_at", "paid_until", "payment", "listing_state", "price_inr"}
    assert c.get(f"/api/properties/{mine['slug']}").status_code == 200
    assert c.get("/api/admin/listings", headers=OWNER).status_code == 403
    assert [x["id"] for x in c.get("/api/owner/listings", headers=OTHER).json()] == []
    assert c.patch(f"/api/owner/listings/{mine['id']}", json={"title": "Hacked"}, headers=OTHER).status_code == 404
    edit = c.patch(f"/api/owner/listings/{mine['id']}", json={"description": "Corner plot now.", "verified": True}, headers=OWNER).json()
    assert edit["description"] == "Corner plot now." and edit["verified"] is False


def test_payment_to_confirmation_and_renewal(c):
    pid = [p for p in c.get("/api/owner/listings", headers=OWNER).json()][0]["id"]
    assert c.post(f"/api/owner/listings/{pid}/payment", json={"plan_id": "7", "utr": "123456789012"}, headers=OWNER).status_code == 422
    assert c.post(f"/api/owner/listings/{pid}/payment", json={"plan_id": "30", "utr": "12"}, headers=OWNER).status_code == 422
    sub = c.post(f"/api/owner/listings/{pid}/payment", json={"plan_id": "30", "utr": "412345678901", "payer_upi": "sumit@okhdfc"}, headers=OWNER)
    assert sub.status_code == 200 and sub.json()["listing_state"] == "payment_submitted" and sub.json()["can_pay"] is False
    assert c.post(f"/api/owner/listings/{pid}/payment", json={"plan_id": "30", "utr": "999999999999"}, headers=OWNER).status_code == 409   # already waiting
    assert any(p["id"] == pid for p in c.get("/api/properties").json())                                                                   # still online while checked
    queue = c.get("/api/admin/listings", headers=ADMIN).json()
    assert queue["counts"]["payment_submitted"] == 1 and queue["items"][0]["payments"][0]["utr"] == "412345678901"
    assert c.post(f"/api/admin/listings/{pid}/confirm", json={}, headers=OWNER).status_code == 403
    done = c.post(f"/api/admin/listings/{pid}/confirm", json={}, headers=ADMIN)
    assert done.status_code == 200
    p = state(c, pid)
    assert p["listing_state"] == "paid" and parse(p["paid_until"]) > datetime.now(timezone.utc) + timedelta(days=29)
    assert c.post(f"/api/admin/listings/{pid}/confirm", json={}, headers=ADMIN).status_code == 404       # nothing left to confirm
    stats = c.get("/api/admin/listings", headers=ADMIN).json()
    assert stats["revenue_total"] == 499 and stats["revenue_month"] == 499
    # a reference number cannot be reused by anyone
    other = c.post("/api/owner/listings", json={**BODY, "title": "Second plot", "video_id": None, "phone": "9830055555"}, headers=OTHER).json()
    assert c.post(f"/api/owner/listings/{other['id']}/payment", json={"plan_id": "30", "utr": "412345678901"}, headers=OTHER).status_code == 409
    # renewing early adds days on top of what is left
    c.post(f"/api/owner/listings/{pid}/payment", json={"plan_id": "90", "utr": "512345678901"}, headers=OWNER)
    c.post(f"/api/admin/listings/{pid}/confirm", json={}, headers=ADMIN)
    assert parse(state(c, pid)["paid_until"]) > datetime.now(timezone.utc) + timedelta(days=118)
    notes = c.get("/api/me/notifications", headers=OWNER).json()
    assert any("confirmed" in n["title"].lower() for n in notes["items"])


def parse(v):
    return datetime.fromisoformat(v).astimezone(timezone.utc)


def test_unpaid_listing_is_removed_after_the_free_days_and_deleted_later(c, monkeypatch):
    mine = c.post("/api/owner/listings", json={**BODY, "title": "Unpaid plot", "video_id": None, "phone": "9830066666"}, headers=OWNER).json()
    pid = mine["id"]
    assert any(p["id"] == pid for p in c.get("/api/properties").json())
    past = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    c.portal.call(lambda: server.db.properties.update_one({"id": pid}, {"$set": {"trial_ends_at": past}}))
    c.portal.call(server.listings_pass)
    assert state(c, pid)["listing_state"] == "expired"
    assert not any(p["id"] == pid for p in c.get("/api/properties").json())
    assert c.get(f"/api/properties/{mine['slug']}").status_code == 404
    assert not any(pid in u for u in [x.text for x in [c.get("/api/sitemap.xml")]])
    assert c.get("/api/owner/listings", headers=OWNER).json()[0]["can_pay"] in (True, False)
    # an expired owner can pay again and comes back online while it is checked
    sub = c.post(f"/api/owner/listings/{pid}/payment", json={"plan_id": "30", "utr": "612345678901"}, headers=OWNER).json()
    assert sub["listing_state"] == "payment_submitted"
    assert any(p["id"] == pid for p in c.get("/api/properties").json())
    assert c.post(f"/api/admin/listings/{pid}/reject", json={"reason": "No such payment in my account"}, headers=ADMIN).status_code == 200
    assert state(c, pid)["listing_state"] == "expired" and not any(p["id"] == pid for p in c.get("/api/properties").json())
    # never confirmed, a month later it is deleted; a paid one is never deleted
    longago = (datetime.now(timezone.utc) - timedelta(days=31)).isoformat()
    c.portal.call(lambda: server.db.properties.update_one({"id": pid}, {"$set": {"expired_at": longago}}))
    c.portal.call(server.listings_pass)
    assert state(c, pid) is None


def test_grace_after_a_payment_is_submitted_but_never_checked(c):
    mine = c.post("/api/owner/listings", json={**BODY, "title": "Slow check", "video_id": None, "phone": "9830077777"}, headers=OTHER).json()
    c.post(f"/api/owner/listings/{mine['id']}/payment", json={"plan_id": "30", "utr": "712345678901"}, headers=OTHER)
    old = (datetime.now(timezone.utc) - timedelta(days=4)).isoformat()
    c.portal.call(lambda: server.db.properties.update_one({"id": mine["id"]}, {"$set": {"payment_submitted_at": old}}))
    c.portal.call(server.listings_pass)
    assert state(c, mine["id"])["listing_state"] == "expired"


def test_paid_listing_expires_and_admin_can_extend_or_remove(c):
    pid = c.get("/api/owner/listings", headers=OWNER).json()[0]["id"]
    c.portal.call(lambda: server.db.properties.update_one({"id": pid}, {"$set": {"paid_until": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()}}))
    c.portal.call(server.listings_pass)
    assert state(c, pid)["listing_state"] == "expired"
    assert c.post(f"/api/admin/listings/{pid}/action", json={"action": "extend", "days": 5}, headers=ADMIN).status_code == 200
    assert state(c, pid)["listing_state"] == "trial" and any(p["id"] == pid for p in c.get("/api/properties").json())
    assert c.post(f"/api/admin/listings/{pid}/action", json={"action": "remove"}, headers=ADMIN).status_code == 200
    assert state(c, pid)["listing_state"] == "removed" and c.get("/api/owner/listings", headers=OWNER).json() == []
    # a listing someone paid for is kept (for the accounts) when the owner deletes it
    paid_id = c.post("/api/owner/listings", json={**BODY, "title": "Keep records", "video_id": None, "phone": "9830088888"}, headers=OWNER).json()["id"]
    c.post(f"/api/owner/listings/{paid_id}/payment", json={"plan_id": "30", "utr": "812345678901"}, headers=OWNER)
    c.post(f"/api/admin/listings/{paid_id}/confirm", json={}, headers=ADMIN)
    assert c.delete(f"/api/owner/listings/{paid_id}", headers=OWNER).status_code == 200
    assert state(c, paid_id)["listing_state"] == "removed"


def test_reminder_the_day_before_the_free_days_end(c, monkeypatch):
    mine = c.post("/api/owner/listings", json={**BODY, "title": "Reminder plot", "video_id": None, "phone": "9830099999"}, headers=OTHER).json()
    soon = (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat()
    c.portal.call(lambda: server.db.properties.update_one({"id": mine["id"]}, {"$set": {"trial_ends_at": soon}}))
    c.portal.call(server.listings_pass)
    c.portal.call(server.listings_pass)
    notes = [n for n in c.get("/api/me/notifications", headers=OTHER).json()["items"] if "end tomorrow" in n["title"]]
    assert len(notes) == 1


def test_owner_photo_upload_needs_sign_in_and_a_real_image(c):
    png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082")
    assert c.post("/api/owner/uploads", files={"file": ("a.png", png, "image/png")}).status_code == 401
    ok = c.post("/api/owner/uploads", files={"file": ("a.png", png, "image/png")}, headers=OWNER)
    assert ok.status_code == 200 and ok.json()["url"].startswith("/api/uploads/")
    assert c.post("/api/owner/uploads", files={"file": ("a.png", b"not an image at all", "image/png")}, headers=OWNER).status_code == 415
