"""CRM insights: morning briefing, ask your CRM, source ROI, forecast, anomalies, weekly report, owner-listing quality checks.
    pytest backend/tests/test_crm_insights_offline.py -n 0"""
import io
import json
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_ins", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="", TURNSTILE_SECRET_KEY="",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-ins-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import server  # noqa: E402
import crm_insights  # noqa: E402
import _iso  # noqa: E402

ADMIN = {"Authorization": "Bearer in2-admin"}
OWNER = {"Authorization": "Bearer in2-owner"}
OWNER2 = {"Authorization": "Bearer in2-owner2"}


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            for uid, email, name, tok, admin in (("i2a", "admin@example.com", "Ayan", "in2-admin", True), ("i2o", "owner-i2@example.com", "Ola Owner", "in2-owner", False), ("i2p", "owner2-i2@example.com", "Pam Poster", "in2-owner2", False)):
                await server.db.users.update_one({"email": email}, {"$set": {"user_id": uid, "name": name, "is_admin": admin}}, upsert=True)
                await server.db.user_sessions.update_one({"session_token": tok}, {"$set": {"user_id": uid, "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        before = client.portal.call(_iso.snapshot, server)
        yield client
        client.portal.call(_iso.restore, server, before)
        client.portal.call(lambda: server.db.spend.delete_many({}))
        client.portal.call(lambda: server.db.image_hashes.delete_many({}))
        client.portal.call(lambda: server.db.settings.delete_many({"_id": {"$regex": "^(crm_auto_state|anom_)"}}))


def mk_lead(c, name, phone, source="99acres", days_old=0, **fields):
    async def go():
        r = await server.ingest_lead(name=name, phone=phone, source=source, message="interested in a flat please", notify=False)
        sets = {**fields}
        if days_old:
            t = (datetime.now(timezone.utc) - timedelta(days=days_old)).isoformat()
            sets.update(created_at=t, updated_at=t)
        if sets:
            await server.db.leads.update_one({"id": r["id"]}, {"$set": sets})
        return r["id"]
    return c.portal.call(go)


def test_morning_briefing_summarises_the_day(c):
    first = mk_lead(c, "Brief Bina", "9832000001")
    over = mk_lead(c, "Brief Overdue", "9832000002", status="contacted", next_follow_up=(datetime.now(timezone.utc) - timedelta(days=2)).isoformat(), first_contacted_at="2026-01-01T00:00:00+00:00")
    c.portal.call(lambda: server.db.listing_payments.insert_one({"id": "pay_brief", "status": "submitted", "utr": "BRIEFUTR0001", "amount": 499, "property_id": "x", "submitted_at": datetime.now(timezone.utc).isoformat()}))
    b = c.get("/api/admin/crm/briefing", headers=ADMIN).json()
    assert b["overnight_leads"] >= 2 and b["payments_to_confirm"] >= 1 and b["plan"] and "overdue" in b["headline"].lower() and "payment" in b["headline"].lower()
    assert any(p["id"] in (first, over) for p in b["plan"]) and c.get("/api/admin/crm/briefing").status_code == 401
    assert c.portal.call(crm_insights.send_briefing, True) is True
    assert any("Good morning" in n["title"] for n in c.get("/api/admin/notifications", headers=ADMIN).json()["items"])
    assert c.portal.call(crm_insights.send_briefing) is False                                      # once a day


def test_ask_your_crm_uses_only_your_numbers(c, monkeypatch):
    seen = {}

    async def fake(prompt, system=None, **kw):
        seen["prompt"] = prompt
        return {"text": "99acres gave 4 leads, none closed yet.", "sources": []}
    assert c.post("/api/admin/crm/ask", json={"question": "How many leads did 99acres give me?"}, headers=ADMIN).status_code == 503
    monkeypatch.setattr(server, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(server, "gemini_call", fake)
    r = c.post("/api/admin/crm/ask", json={"question": "How many leads did 99acres give me this month and how many closed?"}, headers=ADMIN).json()
    assert r["answer"].startswith("99acres gave 4") and r["facts_as_of"]
    facts = json.loads(seen["prompt"].split("<facts>")[-1].split("</facts>")[0])
    assert "per_source_last_months" in facts and "99acres" in facts["per_source_last_months"] and "per_month" in facts
    assert "phone" not in json.dumps(facts).lower() and "9832000001" not in json.dumps(facts)                    # numbers, never people
    assert "ONLY the numbers" in seen["prompt"] and "never instructions" in seen["prompt"]
    assert c.post("/api/admin/crm/ask", json={"question": "hi"}, headers=ADMIN).status_code == 422


def test_what_each_source_costs_and_earns(c):
    month = datetime.now(timezone.utc).astimezone(crm_insights.IST).strftime("%Y-%m")
    for i in range(4):
        mk_lead(c, f"Roi Rina {i}", f"983200010{i}", source="roi_portal", status="closed" if i < 2 else "new", deal_value_inr=5_000_000 if i < 2 else None, closed_at=datetime.now(timezone.utc).isoformat() if i < 2 else None)
    assert c.put("/api/admin/crm/spend", json={"month": month, "source": "ROI Portal", "amount_inr": 40000}, headers=ADMIN).status_code == 200
    assert c.put("/api/admin/crm/spend", json={"month": "2026-13x", "source": "x", "amount_inr": 1}, headers=ADMIN).status_code == 422
    assert c.put("/api/admin/crm/settings", json={"commission_pct": 1.0}, headers=ADMIN).json()["commission_pct"] == 1.0
    row = [r for r in c.get("/api/admin/crm/roi", params={"months": 3}, headers=ADMIN).json()["items"] if r["source"] == "roi_portal"][0]
    assert row["leads"] == 4 and row["closed"] == 2 and row["spend_inr"] == 40000 and row["cost_per_lead"] == 10000 and row["cost_per_deal"] == 20000
    assert row["revenue_inr"] == 100000 and row["roi_pct"] == 150                                      # 2 deals of 50 lakh at 1% = 1 lakh against 40,000 spent


def test_forecast_uses_stage_chances_and_says_where_they_come_from(c):
    for i, st in enumerate(("negotiation", "negotiation", "site_visit", "contacted")):
        mk_lead(c, f"Fore Farid {i}", f"983200020{i}", status=st, deal_value_inr=4_000_000)
    f = c.get("/api/admin/crm/forecast", headers=ADMIN).json()
    assert f["chances"]["negotiation"] > f["chances"]["site_visit"] > f["chances"]["contacted"] and "typical figure" in f["basis"]["negotiation"]
    assert f["expected_inr"] > 0 and f["low_inr"] < f["expected_inr"] < f["high_inr"] and f["top"][0]["expected_inr"] >= f["top"][-1]["expected_inr"] and "estimate" in f["note"]
    assert f["top"][0]["status"] in ("negotiation", "site_visit", "contacted", "new")


def test_anomaly_alerts_and_one_message_a_day(c):
    for i in range(4):
        mk_lead(c, f"Old Oli {i}", f"983200030{i}", source="quiet_portal", days_old=15 + i)
    for i in range(2):
        mk_lead(c, f"Stuck Sita {i}", f"983200031{i}", status="negotiation", days_old=30)
    a = {x["key"]: x for x in c.get("/api/admin/crm/anomalies", headers=ADMIN).json()}
    assert "silent_quiet_portal" in a and "stuck" in a and len(a["stuck"]["lead_ids"]) >= 2
    told = c.portal.call(crm_insights.anomaly_pass)
    assert told >= 2 and c.portal.call(crm_insights.anomaly_pass) == 0
    assert any("quiet_portal has gone quiet" in n["title"] for n in c.get("/api/admin/notifications", headers=ADMIN).json()["items"])


def test_weekly_report_and_a_public_page_without_personal_data(c):
    mk_lead(c, "Week Wasim", "9832000040", source="website")
    d = c.get("/api/admin/crm/weekly", headers=ADMIN).json()
    assert d["leads"] >= 1 and len(d["per_day"]) == 7 and d["by_source"] and "from" in d
    html = crm_insights.weekly_html(d, "https://x.example/report/t")
    assert "Urbanex weekly report" in html and "<script" not in html and "Week Wasim" not in html
    link = c.post("/api/admin/crm/weekly/send", headers=ADMIN).json()["link"]
    token = link.rsplit("/", 1)[1]
    pub = c.get(f"/api/report/{token}").json()
    assert pub["data"]["leads"] >= 1 and "9832000040" not in json.dumps(pub) and "Week Wasim" not in json.dumps(pub)
    assert c.get("/api/report/wrongtoken").status_code == 404
    c.portal.call(lambda: server.db.weekly_reports.update_one({"token": token}, {"$set": {"created_at": (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()}}))
    assert c.get(f"/api/report/{token}").status_code == 404
    assert any("weekly report" in n["title"].lower() for n in c.get("/api/admin/notifications", headers=ADMIN).json()["items"])


def png(seed, size=64):
    from PIL import Image
    im = Image.new("RGB", (size, size), (255, 255, 255))
    px = im.load()
    for x in range(size):
        for y in range(size):
            px[x, y] = (seed * 37 % 255, (x * seed) % 255, (y * (seed + 3)) % 255) if (x // 8 + y // 8 + seed) % 2 else (240, 240, 240)
    b = io.BytesIO()
    im.save(b, "PNG")
    return b.getvalue()


def test_owner_listing_quality_checks(c):
    server._hits.clear()
    c.put("/api/admin/listing-settings", json={"upi_id": "ayan@oksbi"}, headers=ADMIN)

    def upload(tok, data):
        return c.post("/api/owner/uploads", files={"file": ("p.png", data, "image/png")}, headers=tok).json()["url"]

    def list_it(tok, title, **kw):
        body = {"title": title, "zone": "Goda", "property_type": "plot", "area_sqft": 2000, "price_inr": 2000000, "description": "Corner plot with a wide road and clear papers available.",
                "phone": "9832000050", "accepted_terms": True, **kw}
        r = c.post("/api/owner/listings", json=body, headers=tok)
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def quality(pid):
        c.portal.call(__import__("asyncio").sleep, 0.5)
        return c.portal.call(lambda: server.db.properties.find_one({"id": pid}))["quality"]
    photo = png(5)
    first = list_it(OWNER, "Plot with the original photo", image=upload(OWNER, photo))
    assert quality(first)["score"] == 100 and quality(first)["flags"] == []
    stolen = list_it(OWNER2, "Same photo, other owner", image=upload(OWNER2, photo), phone="9832000051")                        # the same picture again
    q = quality(stolen)
    assert any(f["id"] == "photo" and "another owner" in f["text"] for f in q["flags"]) and q["score"] <= 60
    assert any("Check this owner listing" in n["title"] for n in c.get("/api/admin/notifications", headers=ADMIN).json()["items"])
    # a very different price, a phone number in the text, and a thin listing
    for i in range(3):
        c.post("/api/admin/properties", json={"title": f"Goda peer {i}", "zone": "Goda", "property_type": "plot", "area_sqft": 2000, "price_inr": 2000000, "description": "Peer plot", "image": "https://example.com/x.jpg"}, headers=ADMIN)
    odd = list_it(OWNER, "Cheap plot, call 98320 00060", price_inr=100000, description="Call 98320 00060 now", phone="9832000052", area_sqft=2500)
    flags = {f["id"] for f in quality(odd)["flags"]}
    assert {"price", "contact", "thin"} <= flags
    # the same property twice by the same owner
    twin = list_it(OWNER, "Same plot listed again", phone="9832000050")
    assert any(f["id"] == "duplicate" for f in quality(twin)["flags"])
    again = c.post(f"/api/admin/listings/{twin}/quality", headers=ADMIN).json()
    assert again["score"] < 100 and c.post(f"/api/admin/listings/{twin}/quality", headers=OWNER).status_code == 403
    assert server.image_fingerprint(b"not an image") is None
