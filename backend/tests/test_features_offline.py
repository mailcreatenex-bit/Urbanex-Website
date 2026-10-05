"""Offline feature tests: run the real app against an in-memory Mongo (mongomock-motor).

No running server, database or network needed:  pytest backend/tests/test_features_offline.py -n 0
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
    MONGO_URL="mongodb://offline", DB_NAME="offline_test", CORS_ORIGINS="http://localhost:3000",
    ADMIN_EMAILS="admin@example.com", YOUTUBE_API_KEY="", SMTP_HOST="", ALERT_WEBHOOK_URL="", UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-test-uploads-"),
)
import motor.motor_asyncio  # noqa: E402

motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
ADMIN = {"Authorization": "Bearer admin-tok"}
USER = {"Authorization": "Bearer user-tok"}


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            # upsert: other offline test modules may share the in-memory DB within one pytest session
            for uid, email, name, adm in (("a1", "admin@example.com", "Ayan Dey", True), ("u1", "buyer@example.com", "Rina Sen Gupta", False)):
                await server.db.users.update_one({"email": email}, {"$set": {"user_id": uid, "name": name, "is_admin": adm}}, upsert=True)
            for uid, tok in (("a1", "admin-tok"), ("u1", "user-tok")):
                await server.db.user_sessions.update_one({"session_token": tok}, {"$set": {"user_id": uid, "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        yield client


def future_slot(days=3, hour=11):
    return (datetime.now(server.IST) + timedelta(days=days)).replace(hour=hour, minute=0, second=0, microsecond=0)


# ---- search / pricing gate
def test_seed_has_slug_and_coordinates(c):
    p = c.get("/api/properties").json()[0]
    assert p["slug"] and p["latitude"] and "price_inr" not in p


def test_get_by_slug_and_nearby(c):
    slug = c.get("/api/properties").json()[0]["slug"]
    d = c.get(f"/api/properties/{slug}").json()
    assert d["slug"] == slug and isinstance(d["nearby"], list) and d["nearby"]


def test_budget_bands_filter_without_exposing_prices(c):
    r = c.get("/api/properties", params={"budget": "b1"}).json()
    assert r and all("price_inr" not in p for p in r)
    real = {p["id"]: p["price_inr"] for p in c.get("/api/admin/properties", headers=ADMIN).json()}
    assert all(real[p["id"]] < 3_000_000 for p in r)
    assert c.get("/api/properties", params={"budget": "zzz"}).status_code == 422
    assert c.get("/api/properties", params={"sort": "price_asc"}).status_code == 422  # price ordering would leak prices
    assert all("price_inr" not in p for p in c.get("/api/properties", params={"max_price": 3000000}, headers=USER).json())


def test_filters(c):
    r = c.get("/api/properties", params={"property_type": "plot", "min_area": 3000}).json()
    assert r and all(p["property_type"] == "plot" and p["area_sqft"] >= 3000 for p in r)
    assert c.get("/api/properties", params={"q": "(("}).status_code == 200  # regex-safe
    assert c.get("/api/properties", params={"bbox": "23.20,87.80,23.30,87.90"}).json()
    assert c.get("/api/properties", params={"bbox": "bad"}).status_code == 422


# ---- CMS
def test_cms_requires_admin(c):
    body = {"title": "Nope Nope", "zone": "Kalibazar", "property_type": "plot", "area_sqft": 100,
            "price_inr": 100, "description": "d", "image": "https://example.com/a.jpg"}
    assert c.post("/api/admin/properties", json=body).status_code == 401
    assert c.post("/api/admin/properties", json=body, headers=USER).status_code == 403


def test_cms_crud_and_upload(c):
    up = c.post("/api/admin/uploads", files={"file": ("x.png", PNG, "image/png")}, headers=ADMIN)
    assert up.status_code == 200
    url = up.json()["url"]
    assert c.get(url).status_code == 200
    bad = c.post("/api/admin/uploads", files={"file": ("x.png", b"<script>alert(1)</script>", "image/png")}, headers=ADMIN)
    assert bad.status_code == 415

    body = {"title": "TEST Rajbati Court 2BHK", "zone": "Rajbati", "property_type": "apartment", "bedrooms": 2,
            "area_sqft": 1000, "price_inr": 4000000, "description": "d", "image": url,
            "rera_number": "TESTRERA1", "verified": True, "possession": "ready",
            "documents": [{"name": "Title deed", "verified": True}]}
    r = c.post("/api/admin/properties", json=body, headers=ADMIN)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["slug"] == "test-rajbati-court-2bhk" and p["latitude"]
    assert c.post("/api/admin/properties", json={**body, "image": "javascript:alert(1)"}, headers=ADMIN).status_code == 422
    u = c.patch(f"/api/admin/properties/{p['id']}", json={"price_inr": 4100000, "status": "sold"}, headers=ADMIN)
    assert u.json()["price_inr"] == 4100000 and u.json()["status"] == "sold"
    assert c.delete(f"/api/admin/properties/{p['id']}", headers=ADMIN).status_code == 200
    assert c.get(f"/api/properties/{p['id']}").status_code == 404


# ---- saved searches + notifications
def test_saved_search_notifies_on_new_match(c):
    ss = c.post("/api/me/saved-searches",
                json={"name": "Plots", "params": {"property_type": "plot", "evil": "x", "max_price": "9000000", "budget": "b1"}}, headers=USER)
    assert ss.status_code == 200 and ss.json()["params"] == {"property_type": "plot", "budget": "b1"}
    assert c.post("/api/me/saved-searches", json={"name": "n"}).status_code == 401
    body = {"title": "TEST Plot Match", "zone": "Borehat", "property_type": "plot", "area_sqft": 2000,
            "price_inr": 2000000, "description": "d", "image": "https://example.com/a.jpg"}
    c.post("/api/admin/properties", json=body, headers=ADMIN)
    n = c.get("/api/me/notifications", headers=USER).json()
    assert n["unread"] >= 1 and "Plots" in n["items"][0]["title"]
    c.post("/api/me/notifications/read", json={}, headers=USER)
    assert c.get("/api/me/notifications", headers=USER).json()["unread"] == 0
    assert c.delete(f"/api/me/saved-searches/{ss.json()['id']}", headers=USER).status_code == 200


def test_lead_creates_admin_notification(c):
    before = c.get("/api/admin/notifications", headers=ADMIN).json()["unread"]
    assert c.post("/api/leads", json={"name": "Notif Test", "phone": "9831022334"}).status_code == 200
    assert c.get("/api/admin/notifications", headers=ADMIN).json()["unread"] == before + 1
    assert c.get("/api/admin/notifications").status_code == 401
    assert c.post("/api/admin/notifications/read", json={}, headers=ADMIN).json()["ok"]


# ---- visits
def test_visit_booking_flow(c):
    server._hits.clear()  # the booking endpoint is rate-limited per IP
    pid = c.get("/api/properties").json()[0]["id"]
    slot = future_slot()
    day = slot.strftime("%Y-%m-%d")
    assert any(s["available"] for s in c.get("/api/visits/slots", params={"date": day}).json()["slots"])
    body = {"property_id": pid, "name": "Visitor", "phone": "9831056789", "slot": slot.isoformat()}
    r = c.post("/api/visits", json=body)
    assert r.status_code == 200, r.text
    assert c.post("/api/visits", json=body).status_code == 409  # double booking
    assert [s for s in c.get("/api/visits/slots", params={"date": day}).json()["slots"] if not s["available"]]
    assert c.post("/api/visits", json={**body, "slot": (slot + timedelta(minutes=30)).isoformat()}).status_code == 422
    assert c.post("/api/visits", json={**body, "slot": future_slot(hour=23).isoformat()}).status_code == 422
    assert c.post("/api/visits", json={**body, "slot": datetime.now(server.IST).isoformat()}).status_code == 422
    vid = r.json()["id"]
    assert c.patch(f"/api/admin/visits/{vid}", json={"status": "confirmed"}, headers=ADMIN).json()["status"] == "confirmed"
    assert c.get("/api/admin/visits").status_code == 401
    leads = c.get("/api/admin/leads", params={"source": "site_visit"}, headers=ADMIN).json()
    assert leads and leads[0]["status"] == "site_visit"
    c.patch(f"/api/admin/visits/{vid}", json={"status": "cancelled"}, headers=ADMIN)
    server._hits.clear()
    assert c.post("/api/visits", json={**body, "name": "Next"}).status_code == 200  # slot freed


def test_reminder_pass_flags_visits(c):
    async def go():
        soon = server.now_utc() + timedelta(minutes=40)
        await server.db.visits.insert_one({"id": "visit_rem", "property_title": "P", "name": "Rem", "phone": "1", "email": None,
                                           "slot": server.slot_str(soon), "status": "confirmed",
                                           "reminded_24h": False, "reminded_1h": False})
        await server.process_reminders()
        return await server.db.visits.find_one({"id": "visit_rem"})
    v = c.portal.call(go)
    assert v["reminded_1h"] and v["reminded_24h"]


# ---- reviews
def test_review_moderation(c):
    assert c.post("/api/reviews", json={"rating": 5, "text": "Great service from Ayan"}).status_code == 401
    assert c.post("/api/reviews", json={"rating": 5, "text": "Great service from Ayan"}, headers=USER).status_code == 200
    assert c.post("/api/reviews", json={"rating": 5, "text": "Great service again"}, headers=USER).status_code == 409
    assert c.get("/api/reviews").json()["summary"]["count"] == 0  # pending => hidden
    rid = c.get("/api/admin/reviews", headers=ADMIN).json()[0]["id"]
    c.patch(f"/api/admin/reviews/{rid}", json={"status": "approved"}, headers=ADMIN)
    pub = c.get("/api/reviews").json()
    assert pub["summary"] == {"count": 1, "average": 5.0}
    assert pub["items"][0]["name"] == "Rina G." and "user_id" not in pub["items"][0]


# ---- blog + seo
def test_blog_and_seo(c):
    r = c.post("/api/admin/posts", json={"title": "Living in Kalibazar", "body": "## Intro\n\nText", "published": False}, headers=ADMIN)
    assert r.status_code == 200
    slug = r.json()["slug"]
    assert c.get(f"/api/posts/{slug}").status_code == 404  # drafts are private
    c.patch(f"/api/admin/posts/{r.json()['id']}", json={"published": True}, headers=ADMIN)
    assert c.get(f"/api/posts/{slug}").status_code == 200
    assert slug in [p["slug"] for p in c.get("/api/posts").json()]
    sm = c.get("/api/sitemap.xml")
    assert sm.status_code == 200 and f"/blog/{slug}" in sm.text and "/properties/" in sm.text
    pslug = c.get("/api/properties").json()[0]["slug"]
    sh = c.get(f"/api/share/properties/{pslug}")
    assert 'property="og:title"' in sh.text and "price" not in sh.text.lower()
    assert c.get(f"/api/share/blog/{slug}").status_code == 200
    assert c.get("/api/share/properties/nope").status_code == 404
