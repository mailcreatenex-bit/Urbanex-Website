"""CRM deals: visit link, calendar feed, visit reminders, document checklist, bank hand-off.
    pytest backend/tests/test_crm_deals_offline.py -n 0"""
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_deals", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="", TURNSTILE_SECRET_KEY="",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-deals-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import server  # noqa: E402
import crm_deals  # noqa: E402
import _iso  # noqa: E402

ADMIN = {"Authorization": "Bearer de-admin"}


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            await server.db.users.update_one({"email": "admin@example.com"}, {"$set": {"user_id": "dea", "name": "Ayan", "is_admin": True}}, upsert=True)
            await server.db.user_sessions.update_one({"session_token": "de-admin"}, {"$set": {"user_id": "dea", "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        before = client.portal.call(_iso.snapshot, server)
        yield client
        client.portal.call(_iso.restore, server, before)
        client.portal.call(lambda: server.db.settings.delete_many({"_id": {"$in": ["calendar", "crm_auto_state"]}}))


def mk(c, name, phone, **kw):
    body = {"name": name, "phone": phone, "source_page": "99acres"}
    if "email" in kw:
        body["email"] = kw.pop("email")
    lid = c.post("/api/admin/leads", json=body, headers=ADMIN).json()["id"]
    if kw:
        c.patch(f"/api/admin/leads/{lid}", json=kw, headers=ADMIN)
    return lid


def future_slot(days=3):
    d = datetime.now(timezone(timedelta(hours=5, minutes=30))) + timedelta(days=days)
    while d.weekday() in server.VISIT_CLOSED_WEEKDAYS:
        d += timedelta(days=1)
    return d.replace(hour=11, minute=0, second=0, microsecond=0)


def prop(c):
    return c.post("/api/admin/properties", json={"title": "Visit flat", "zone": "Goda", "property_type": "apartment", "area_sqft": 900, "price_inr": 4000000, "description": "Flat",
                                                 "image": "https://example.com/v.jpg"}, headers=ADMIN).json()


def test_a_lead_picks_their_own_visit_time_from_a_link(c):
    server._hits.clear()
    lid = mk(c, "Link Lata", "9831000001")
    p = prop(c)
    assert c.post(f"/api/admin/leads/{lid}/visit-link", json={"mode": "onsite"}, headers=ADMIN).status_code == 422              # which property?
    r = c.post(f"/api/admin/leads/{lid}/visit-link", json={"property_id": p["id"]}, headers=ADMIN).json()
    token = r["link"].rsplit("/", 1)[1]
    assert r["link"].endswith(f"/book-visit/{token}") and "Visit flat" in r["text"]
    info = c.get(f"/api/visit-links/{token}").json()
    assert info["name"] == "Link Lata" and info["property"]["title"] == "Visit flat" and "phone" not in str(info)
    slot = future_slot()
    booked = c.post(f"/api/visit-links/{token}/book", json={"slot": slot.isoformat()})
    assert booked.status_code == 200, booked.text
    lead = c.get("/api/admin/leads", params={"q": "9831000001"}, headers=ADMIN).json()[0]
    assert lead["status"] == "site_visit" and any(a["type"] == "visit" for a in lead["activities"])
    visit = c.portal.call(lambda: server.db.visits.find_one({"lead_id": lid}))
    assert visit["status"] == "confirmed" and visit["property_id"] == p["id"]
    assert c.post(f"/api/visit-links/{token}/book", json={"slot": slot.isoformat()}).status_code == 409                   # a link is used once
    assert c.get("/api/visit-links/not-a-token").status_code == 404
    other = c.post(f"/api/admin/leads/{mk(c, 'Second Sita', '9831000002')}/visit-link", json={"property_id": p["id"]}, headers=ADMIN).json()["link"].rsplit("/", 1)[1]
    assert c.post(f"/api/visit-links/{other}/book", json={"slot": slot.isoformat()}).status_code == 409                    # the time is taken
    assert c.post(f"/api/visit-links/{other}/book", json={"slot": (slot + timedelta(minutes=17)).isoformat()}).status_code == 422   # not on the hour
    c.portal.call(lambda: server.db.visit_links.update_one({"token": other}, {"$set": {"expires_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}}))
    assert c.get(f"/api/visit-links/{other}").status_code == 404


def test_public_booking_joins_the_existing_lead_instead_of_duplicating(c):
    server._hits.clear()
    lid = mk(c, "Existing Esha", "9831000003", status="contacted")
    p = prop(c)
    r = c.post("/api/visits", json={"property_id": p["id"], "name": "Esha D", "phone": "98310 00003", "slot": future_slot(4).isoformat()})
    assert r.status_code == 200, r.text
    rows = c.get("/api/admin/leads", params={"q": "9831000003"}, headers=ADMIN).json()
    assert len(rows) == 1 and rows[0]["id"] == lid and rows[0]["status"] == "site_visit"


def test_calendar_feed_lists_visits_for_your_phone(c):
    url = c.get("/api/admin/crm/calendar", headers=ADMIN).json()["url"]
    token = url.rsplit("/", 1)[1][:-4]
    assert c.get("/api/admin/crm/calendar").status_code == 401 and c.get("/api/calendar/wrong.ics").status_code == 404
    r = c.get(f"/api/calendar/{token}.ics")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/calendar")
    body = r.text
    assert body.startswith("BEGIN:VCALENDAR") and "Visit: Link Lata - Visit flat" in body and "BEGIN:VALARM" in body and body.count("BEGIN:VEVENT") == body.count("END:VEVENT") >= 2
    assert all(len(line.encode()) <= 75 for line in body.split("\r\n"))


def test_customer_gets_whatsapp_reminders_before_a_visit(c):
    lid = mk(c, "Remind Ravi", "9831000004")
    soon = datetime.now(timezone.utc) + timedelta(hours=1, minutes=30)
    visit = {"id": "visit_remind1", "property_id": None, "property_title": "Reminder flat", "name": "Remind Ravi", "phone": "+919831000004", "email": None, "mode": "onsite", "tz": "Asia/Kolkata",
             "slot": server.slot_str(soon.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)), "status": "confirmed", "lead_id": lid, "reminded_24h": True, "reminded_1h": True,
             "created_at": datetime.now(timezone.utc).isoformat()}
    c.portal.call(lambda: server.db.visits.insert_one(dict(visit)))
    assert c.portal.call(crm_deals.visit_reminders_pass) >= 1
    rows = c.portal.call(lambda: server.db.outbox.find({"lead_id": lid, "kind": "visit_reminder"}).to_list(5))
    assert rows and "Reminder flat" in rows[0]["text"] and "Remind" in rows[0]["text"]
    assert c.portal.call(crm_deals.visit_reminders_pass) == 0                                    # each reminder once


def test_document_checklist_for_a_deal_with_late_reminders(c):
    lid = mk(c, "Docs Debu", "9831000005", language="bn", status="negotiation")
    items = c.post(f"/api/admin/leads/{lid}/checklist", json={"type": "plot_purchase", "due_in_days": 1}, headers=ADMIN).json()
    assert len(items) == 12 and items[0]["status"] == "pending" and {i["party"] for i in items} == {"buyer", "seller", "us"}
    assert len(c.post(f"/api/admin/leads/{lid}/checklist", json={"type": "plot_purchase"}, headers=ADMIN).json()) == 12                       # starting twice adds nothing
    assert c.patch(f"/api/admin/leads/{lid}/checklist/buyer_kyc", json={"status": "received", "note": "Aadhaar on WhatsApp"}, headers=ADMIN).status_code == 200
    assert c.patch(f"/api/admin/leads/{lid}/checklist/nope", json={"status": "received"}, headers=ADMIN).status_code == 404
    assert c.patch(f"/api/admin/leads/{lid}/checklist/khatian", json={"status": "weird"}, headers=ADMIN).status_code == 422
    ov = [o for o in c.get("/api/admin/crm/checklists", headers=ADMIN).json() if o["id"] == lid][0]
    assert ov["total"] == 12 and ov["done"] == 1 and all("ID and address proof (Aadhaar" not in p for p in ov["pending"])
    # tomorrow the papers are late: the customer is asked (in Bengali), and you are told
    async def make_late():
        docs = (await server.db.leads.find_one({"id": lid}))["deal_docs"]
        for d in docs:
            d["due"] = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        await server.db.leads.update_one({"id": lid}, {"$set": {"deal_docs": docs}})
    c.portal.call(make_late)
    c.portal.call(lambda: server.db.settings.delete_many({"_id": "crm_auto_state"}))
    assert c.portal.call(crm_deals.checklist_pass) >= 1
    msg = c.portal.call(lambda: server.db.outbox.find({"lead_id": lid, "kind": "doc_reminder"}).to_list(5))[0]
    assert "নমস্কার Docs" in msg["text"] and "Title deed" in msg["text"]
    assert "Registration done" not in msg["text"] and "Sale agreement" not in msg["text"]                           # only papers the customer or seller owns, not the ones you do
    assert any("pending for Docs Debu" in n["title"] for n in c.get("/api/admin/notifications", headers=ADMIN).json()["items"])
    assert c.portal.call(crm_deals.checklist_pass) == 0                                                                  # once a day


def test_bank_hand_off_and_commission(c):
    lid = mk(c, "Loan Lopa", "9831000006", email="lopa@example.com")
    bank = c.post("/api/admin/crm/partners", json={"name": "State Bank Burdwan", "kind": "bank", "phone": "9831000100", "email": "sbi@example.com", "commission_pct": 0.5}, headers=ADMIN).json()
    assert c.post("/api/admin/crm/partners", json={"name": "x", "email": "bad"}, headers=ADMIN).status_code == 422
    assert [p["name"] for p in c.get("/api/admin/crm/partners", headers=ADMIN).json()] == ["State Bank Burdwan"]
    assert c.post(f"/api/admin/leads/{lid}/loan/refer", json={"partner_id": "nope", "amount_inr": 3000000}, headers=ADMIN).status_code == 404
    r = c.post(f"/api/admin/leads/{lid}/loan/refer", json={"partner_id": bank["id"], "amount_inr": 3000000, "note": "salaried"}, headers=ADMIN).json()
    assert r["loan"]["status"] == "referred" and "Loan Lopa" in r["share_text"] and "₹30.00 L" in r["share_text"] and r["loan"]["commission_pct"] == 0.5
    assert c.patch(f"/api/admin/leads/{lid}/loan", json={"status": "sanctioned", "sanctioned_inr": 2800000}, headers=ADMIN).json()["sanctioned_inr"] == 2800000
    done = c.patch(f"/api/admin/leads/{lid}/loan", json={"status": "disbursed", "disbursed_inr": 2800000}, headers=ADMIN).json()
    assert done["commission_inr"] == 14000 and [h["status"] for h in done["history"]] == ["referred", "sanctioned", "disbursed"]
    ov = c.get("/api/admin/crm/loans", headers=ADMIN).json()
    assert ov["totals"]["disbursed"] == 1 and ov["totals"]["commission_due"] == 14000 and ov["totals"]["commission_paid"] == 0
    c.patch(f"/api/admin/leads/{lid}/loan", json={"commission_paid": True}, headers=ADMIN)
    assert c.get("/api/admin/crm/loans", headers=ADMIN).json()["totals"]["commission_paid"] == 14000
    assert c.patch(f"/api/admin/leads/{mk(c, 'No Loan', '9831000007')}/loan", json={"status": "sanctioned"}, headers=ADMIN).status_code == 404
