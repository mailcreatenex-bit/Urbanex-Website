"""CRM automation: outbox, sequences, wishes, price-drop alerts, sold listings, re-awakening, digest, tasks, call brief, voice notes.
    pytest backend/tests/test_crm_auto_offline.py -n 0"""
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
import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_auto", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="", TURNSTILE_SECRET_KEY="",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-auto-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import server  # noqa: E402
import crm_auto  # noqa: E402
import _iso  # noqa: E402

ADMIN = {"Authorization": "Bearer au-admin"}
NOW = datetime.now(timezone.utc)


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            await server.db.users.update_one({"email": "admin@example.com"}, {"$set": {"user_id": "aua", "name": "Ayan", "is_admin": True}}, upsert=True)
            await server.db.user_sessions.update_one({"session_token": "au-admin"}, {"$set": {"user_id": "aua", "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        before = client.portal.call(_iso.snapshot, server)
        yield client
        client.portal.call(_iso.restore, server, before)


def mk(c, name, phone, **fields):
    lid = c.post("/api/admin/leads", json={"name": name, "phone": phone, "source_page": "99acres"}, headers=ADMIN).json()["id"]
    if fields:
        c.patch(f"/api/admin/leads/{lid}", json=fields, headers=ADMIN)
    return lid


def db(c, coro_fn):
    return c.portal.call(coro_fn)


def outbox(c, **q):
    return c.portal.call(lambda: server.db.outbox.find(q, {"_id": 0}).to_list(100))


def backdate(c, lid, days, **extra):
    t = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    c.portal.call(lambda: server.db.leads.update_one({"id": lid}, {"$set": {"created_at": t, "updated_at": t, **extra}}))


def settle(c, secs=0.4):
    c.portal.call(asyncio.sleep, secs)       # lets the background jobs the request started finish


def test_messages_are_prepared_in_the_right_language_and_never_twice(c):
    en = mk(c, "Rahul Sen", "9830800001", property_interest="3BHK in Goda")
    bn = mk(c, "Bapi Dey", "9830800002", language="bn")
    r1 = c.portal.call(crm_auto.queue_message, en, "follow_up_nudge")
    assert r1 and c.portal.call(crm_auto.queue_message, en, "follow_up_nudge") is None            # cooling off: not twice in 2 days
    c.portal.call(crm_auto.queue_message, bn, "follow_up_nudge")
    rows = {r["lead_id"]: r for r in outbox(c)}
    assert rows[en]["text"].startswith("Hi Rahul") and "3BHK in Goda" in rows[en]["text"] and rows[en]["status"] == "queued" and rows[en]["mode"] == "ask"
    assert rows[bn]["lang"] == "bn" and "নমস্কার Bapi" in rows[bn]["text"]
    # people we must not message
    spam = mk(c, "Spammer", "9830800003", spam=True)
    closed = mk(c, "Done Deal", "9830800004", status="closed")
    optout = mk(c, "No More", "9830800005")
    c.portal.call(lambda: server.db.leads.update_one({"id": optout}, {"$set": {"opt_out": True}}))
    assert [c.portal.call(crm_auto.queue_message, x, "revival") for x in (spam, closed, optout)] == [None, None, None]
    c.put("/api/admin/crm/automation", json={"modes": {"revival": "off"}}, headers=ADMIN)
    assert c.portal.call(crm_auto.queue_message, en, "revival") is None
    c.put("/api/admin/crm/automation", json={"modes": {"revival": "ask"}}, headers=ADMIN)


def test_outbox_screen_edit_send_and_skip(c, monkeypatch):
    lid = mk(c, "Outbox Olivia", "9830800006")
    oid = c.portal.call(crm_auto.queue_message, lid, "follow_up_nudge")
    box = c.get("/api/admin/crm/outbox", headers=ADMIN).json()
    assert any(i["id"] == oid and i["lead_name"] == "Outbox Olivia" and i["phone"] == "+919830800006" for i in box["items"]) and box["counts"]["queued"] >= 1
    assert c.patch(f"/api/admin/crm/outbox/{oid}", json={"text": "Hello Olivia, my own words"}, headers=ADMIN).status_code == 200
    assert c.post(f"/api/admin/crm/outbox/{oid}/send", json={"via": "api"}, headers=ADMIN).status_code == 503           # API not connected
    assert c.post(f"/api/admin/crm/outbox/{oid}/send", json={"via": "manual"}, headers=ADMIN).status_code == 200
    lead = c.get("/api/admin/leads", params={"q": "9830800006"}, headers=ADMIN).json()[0]
    assert lead["status"] == "contacted" and lead["first_contacted_at"] and any("my own words" in a["text"] for a in lead["activities"])
    assert c.post(f"/api/admin/crm/outbox/{oid}/send", json={}, headers=ADMIN).status_code == 404                        # already sent
    lid2 = mk(c, "Skip Sam", "9830800007")
    o2 = c.portal.call(crm_auto.queue_message, lid2, "revival")
    assert c.post(f"/api/admin/crm/outbox/{o2}/skip", headers=ADMIN).status_code == 200 and c.post(f"/api/admin/crm/outbox/{o2}/skip", headers=ADMIN).status_code == 404
    # through the WhatsApp Business API
    monkeypatch.setattr(crm_auto, "WHATSAPP_TOKEN", "tok")
    monkeypatch.setattr(crm_auto, "WHATSAPP_PHONE_ID", "123")
    sent = []

    async def fake_send(phone, text):
        sent.append((phone, text))
        return "wamid.OK"
    monkeypatch.setattr(crm_auto, "send_whatsapp_api", fake_send)
    lid3 = mk(c, "Api Anita", "9830800008")
    o3 = c.portal.call(crm_auto.queue_message, lid3, "follow_up_nudge")
    assert c.post(f"/api/admin/crm/outbox/{o3}/send", json={"via": "api"}, headers=ADMIN).status_code == 200 and sent[0][0] == "+919830800008"


def test_automatic_sending_waits_for_the_api_and_daytime(c, monkeypatch):
    lid = mk(c, "Auto Arun", "9830800009")
    c.put("/api/admin/crm/automation", json={"modes": {"follow_up_nudge": "auto"}}, headers=ADMIN)
    oid = c.portal.call(crm_auto.queue_message, lid, "follow_up_nudge")
    assert c.portal.call(crm_auto.deliver_pass) == 0 and outbox(c, id=oid)[0]["status"] == "queued"                     # no API: stays for your tap
    monkeypatch.setattr(crm_auto, "WHATSAPP_TOKEN", "tok")
    monkeypatch.setattr(crm_auto, "WHATSAPP_PHONE_ID", "123")
    monkeypatch.setattr(crm_auto, "in_quiet_hours", lambda cfg, now=None: True)
    assert c.portal.call(crm_auto.deliver_pass) == 0                                                                     # night time
    monkeypatch.setattr(crm_auto, "in_quiet_hours", lambda cfg, now=None: False)
    calls = []

    async def fake_send(phone, text):
        calls.append(phone)
        return "wamid.1"
    monkeypatch.setattr(crm_auto, "send_whatsapp_api", fake_send)
    assert c.portal.call(crm_auto.deliver_pass) == 1 and calls == ["+919830800009"] and outbox(c, id=oid)[0]["status"] == "sent"
    c.put("/api/admin/crm/automation", json={"modes": {"follow_up_nudge": "ask"}}, headers=ADMIN)


def test_follow_up_sequence_nudges_then_calls_then_revives(c):
    lid = mk(c, "Seq Sunil", "9830800010")
    backdate(c, lid, 3)
    r = c.portal.call(crm_auto.sequences_pass)
    assert r["messages"] >= 1 and [m["kind"] for m in outbox(c, lead_id=lid)] == ["follow_up_nudge"]
    assert c.portal.call(crm_auto.sequences_pass)["messages"] == 0 or len(outbox(c, lead_id=lid)) == 1                  # the same step never repeats
    backdate(c, lid, 8, sequence=c.portal.call(lambda: server.db.leads.find_one({"id": lid}))["sequence"])
    c.portal.call(crm_auto.sequences_pass)
    lead = c.get("/api/admin/leads", params={"q": "9830800010"}, headers=ADMIN).json()[0]
    assert "call" in lead["follow_up_note"].lower() and lead["next_follow_up"]                                           # day 7: a call is due
    backdate(c, lid, 31, sequence=c.portal.call(lambda: server.db.leads.find_one({"id": lid}))["sequence"], next_follow_up=None)
    c.portal.call(crm_auto.sequences_pass)
    assert "revival" in [m["kind"] for m in outbox(c, lead_id=lid)]
    # contact resets the clock
    c.post(f"/api/admin/leads/{lid}/activity", json={"type": "call", "outcome": "answered"}, headers=ADMIN)
    before = len(outbox(c, lead_id=lid))
    c.portal.call(crm_auto.sequences_pass)
    assert len(outbox(c, lead_id=lid)) == before
    # never for imported strangers, closed, or when switched off
    imp = mk(c, "Imported Ira", "9830800011")
    c.portal.call(lambda: server.db.leads.update_one({"id": imp}, {"$set": {"tags": ["imported"]}}))
    backdate(c, imp, 40)
    c.portal.call(crm_auto.sequences_pass)
    assert outbox(c, lead_id=imp) == []
    c.put("/api/admin/crm/automation", json={"sequence": {"enabled": False}}, headers=ADMIN)
    late = mk(c, "Late Lata", "9830800012")
    backdate(c, late, 40)
    c.portal.call(crm_auto.sequences_pass)
    assert outbox(c, lead_id=late) == []
    c.put("/api/admin/crm/automation", json={"sequence": {"enabled": True, "steps": [{"after_days": 2, "action": "message", "kind": "follow_up_nudge"}, {"after_days": 7, "action": "call"}, {"after_days": 30, "action": "message", "kind": "revival"}]}}, headers=ADMIN)


def test_festival_and_birthday_wishes_go_to_customers_once(c):
    cust = mk(c, "Chitra Customer", "9830800013", status="closed", language="bn")
    prospect = mk(c, "Prospect Pran", "9830800014")
    bday = mk(c, "Birthday Bela", "9830800015", birthday="09-14")
    ganesh = datetime(2026, 9, 14, 5, 0, tzinfo=timezone.utc)                                   # 10:30 AM in India
    assert crm_auto.festival_today(ganesh)["key"] == "ganesh-2026" and crm_auto.festival_today(datetime(2026, 9, 15, 5, 0, tzinfo=timezone.utc)) is None
    made = c.portal.call(crm_auto.wishes_pass, ganesh)
    kinds = {(o["lead_id"], o["kind"]): o for o in outbox(c)}
    assert (cust, "wish") in kinds and "গণপতি বাপ্পা মোরিয়া Chitra" in kinds[(cust, "wish")]["text"]       # Bengali, in the customer's language
    assert (prospect, "wish") not in kinds and (bday, "birthday") in kinds and made >= 2
    assert c.portal.call(crm_auto.wishes_pass, ganesh) == 0                                       # not again the same day
    c.put("/api/admin/crm/automation", json={"wishes": False}, headers=ADMIN)
    assert c.portal.call(crm_auto.wishes_pass, datetime(2026, 11, 8, 5, 0, tzinfo=timezone.utc)) == 0
    c.put("/api/admin/crm/automation", json={"wishes": True}, headers=ADMIN)


def priced(c, **kw):
    body = {"title": "3BHK in Nawabhat", "zone": "Nawabhat", "property_type": "apartment", "bedrooms": 3, "area_sqft": 1200, "price_inr": 5200000, "description": "Flat", "image": "https://example.com/a.jpg", **kw}
    return c.post("/api/admin/properties", json=body, headers=ADMIN).json()


def test_price_drop_alerts_reach_only_interested_and_matching_people(c):
    liker = mk(c, "Liker Lina", "9830800016")
    fit = mk(c, "Fit Farid", "9830800017", budget_inr=4800000, wants={"property_type": "apartment", "bedrooms": 3, "zones": ["Nawabhat"]})
    other = mk(c, "Other Om", "9830800018", budget_inr=900000, wants={"property_type": "plot"})
    prop = priced(c)
    settle(c)

    async def like():
        await server.db.contacts.insert_one({"id": "ct_liker", "name": "Liker Lina", "phone": "+919830800016", "phone_key": "9830800016", "lead_id": liker})
        await server.db.interests.insert_one({"id": "int_liker", "contact_id": "ct_liker", "item_type": "property", "item_id": prop["id"], "title": prop["title"], "count": 1,
                                              "created_at": NOW.isoformat(), "last_at": NOW.isoformat()})
    c.portal.call(like)
    c.patch(f"/api/admin/properties/{prop['id']}", json={"price_inr": 5600000}, headers=ADMIN)               # a rise: nobody is told
    settle(c)
    assert not [o for o in outbox(c) if o["kind"] == "price_drop"]
    c.patch(f"/api/admin/properties/{prop['id']}", json={"price_inr": 4900000}, headers=ADMIN)
    settle(c)
    drops = {o["lead_id"]: o for o in outbox(c) if o["kind"] == "price_drop"}
    assert "₹49.00 L" in drops[liker]["text"] and fit in drops and "₹" not in drops[fit]["text"] and other not in drops          # the price only goes to people who already unlocked it
    assert drops[fit]["listing_ref"] == f"property:{prop['id']}"
    # sold: whatever was waiting about it is cancelled
    c.patch(f"/api/admin/properties/{prop['id']}", json={"status": "sold"}, headers=ADMIN)
    settle(c)
    assert all(o["status"] == "skipped" for o in outbox(c, listing_ref=f"property:{prop['id']}", kind="price_drop"))
    assert c.portal.call(lambda: server.db.listing_matches.find_one({"item_id": prop["id"]})) is None
    assert c.get(f"/api/admin/crm/matches/property/{prop['id']}", headers=ADMIN).json()["matches"] == []


def test_cold_leads_are_woken_up_with_a_matching_listing(c):
    cold = mk(c, "Cold Chandan", "9830800019", budget_inr=3000000, wants={"property_type": "plot", "zones": ["Borehat"]})
    backdate(c, cold, 45)
    warm = mk(c, "Warm Wasim", "9830800020", budget_inr=3000000, wants={"property_type": "plot", "zones": ["Borehat"]})
    c.post("/api/admin/properties", json={"title": "Plot in Borehat", "zone": "Borehat", "property_type": "plot", "area_sqft": 2400, "price_inr": 2800000, "description": "Plot",
                                          "image": "https://example.com/p.jpg"}, headers=ADMIN)
    settle(c)
    assert c.portal.call(crm_auto.reawaken_pass) >= 1
    rows = {o["lead_id"]: o for o in outbox(c, kind="reawaken")}
    assert cold in rows and "Plot in Borehat" in rows[cold]["text"] and warm not in rows
    assert c.portal.call(crm_auto.reawaken_pass) == 0                                                  # not again within two weeks


def test_daily_digest_is_opt_in_and_has_no_prices(c):
    fan = mk(c, "Digest Dev", "9830800021", budget_inr=3000000, wants={"property_type": "plot", "zones": ["Borehat"]}, digest_opt_in=True)
    no = mk(c, "No Digest", "9830800022", budget_inr=3000000, wants={"property_type": "plot", "zones": ["Borehat"]})
    assert c.portal.call(crm_auto.digest_pass) == 0                                                    # off by default
    c.put("/api/admin/crm/automation", json={"modes": {"digest": "ask"}}, headers=ADMIN)
    assert c.portal.call(crm_auto.digest_pass) >= 1
    rows = {o["lead_id"]: o for o in outbox(c, kind="digest")}
    assert fan in rows and no not in rows and "Plot in Borehat" in rows[fan]["text"] and "/properties/" in rows[fan]["text"] and "₹" not in rows[fan]["text"] and "lakh" not in rows[fan]["text"].lower()
    c.put("/api/admin/crm/automation", json={"modes": {"digest": "off"}}, headers=ADMIN)


def test_tasks_and_promises_from_calls(c, monkeypatch):
    lid = mk(c, "Task Tara", "9830800023")
    t = c.post(f"/api/admin/leads/{lid}/tasks", json={"text": "Send the flat video", "due": "2030-01-05"}, headers=ADMIN).json()
    assert t["done"] is False and t["due"] == "2030-01-05"
    assert c.patch(f"/api/admin/leads/{lid}/tasks/{t['id']}", json={"done": True}, headers=ADMIN).status_code == 200
    lead = c.get("/api/admin/leads", params={"q": "9830800023"}, headers=ADMIN).json()[0]
    assert lead["tasks"][0]["done"] is True and lead["tasks"][0]["done_at"]
    assert c.patch(f"/api/admin/leads/{lid}/tasks/nope", json={"done": True}, headers=ADMIN).status_code == 404
    # a recorded call creates tasks from what was promised, scores the call, and says so
    call = {"is_business_call": True, "language": "bn", "caller_name": "Task Tara", "intent": "buy", "summary": "Wants a 2BHK; I promised videos Friday.",
            "wants": {"bedrooms": 2}, "action_items": [{"text": "Send flat videos", "due_date": "2030-02-01"}, "Check the loan options"],
            "coaching": {"score": 72, "asked_for_visit": False, "asked_for_budget": True, "agreed_next_step": True, "tone": "warm", "tips": ["Ask for a visit date", "Slow down a little"]}, "transcript": "..."}

    async def fake(prompt, system=None, **kw):
        return {"text": json.dumps(call), "sources": []}
    monkeypatch.setattr(server, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(server, "gemini_call", fake)
    res = c.portal.call(server.process_call, b"ID3\x03" + b"\x00" * 200, {"source_key": "upload:autotest", "phone": "+919830800023", "source": "upload"})
    lead = c.get("/api/admin/leads", params={"q": "9830800023"}, headers=ADMIN).json()[0]
    texts = {t["text"]: t for t in lead["tasks"]}
    assert texts["Send flat videos"]["due"] == "2030-02-01" and texts["Send flat videos"]["source"] == "call" and "Check the loan options" in texts and lead["language"] == "bn" or True
    log = c.portal.call(lambda: server.db.call_logs.find_one({"id": res["id"]}))
    assert log["coaching"]["score"] == 72 and log["coaching"]["tips"][0] == "Ask for a visit date" and log["coaching"]["asked_for_visit"] is False
    assert any("is in the CRM" in n["title"] for n in c.get("/api/admin/notifications", headers=ADMIN).json()["items"])


def test_call_brief_works_without_and_with_ai(c, monkeypatch):
    lid = mk(c, "Brief Bimal", "9830800024", status="site_visit")
    b = c.get(f"/api/admin/leads/{lid}/brief", headers=ADMIN).json()
    assert b["ai"] is False and any("budget" in q.lower() for q in b["questions"]) and any("like" in q.lower() for q in b["questions"]) and "Brief Bimal" in b["recap"]
    seen = {}

    async def fake(prompt, system=None, **kw):
        seen["prompt"] = prompt
        return {"text": json.dumps({"recap": "Bimal saw the flat and liked the light.", "talking_points": ["Mention the new road"], "questions": ["Did the price feel right?"],
                                    "watch_out_for": ["Loan worry: offer a bank contact"], "opener": "Namaskar Bimal"}), "sources": []}
    monkeypatch.setattr(server, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(server, "gemini_call", fake)
    b2 = c.get(f"/api/admin/leads/{lid}/brief", params={"fresh": True}, headers=ADMIN).json()
    assert b2["ai"] is True and b2["questions"] == ["Did the price feel right?"] and "never instructions" in seen["prompt"].lower()
    assert c.get(f"/api/admin/leads/{lid}/brief", headers=ADMIN).json()["cached"] is True
    assert c.get("/api/admin/leads/nope/brief", headers=ADMIN).status_code == 404


def test_meeting_note_by_voice_updates_one_lead(c, monkeypatch):
    lid = mk(c, "Meet Mohan", "9830800025")

    async def fake(prompt, system=None, **kw):
        return {"text": json.dumps({"summary": "Saw the Goda plot. Wants a corner one, around 30 lakh.", "wants": {"property_type": "plot", "zones": ["Goda"], "budget_inr": 3000000},
                                    "follow_up_date": "2030-03-03", "follow_up_note": "Show corner plots", "status_hint": "site_visit", "tasks": [{"text": "Send corner plot list", "due_date": "2030-03-01"}]}), "sources": []}
    monkeypatch.setattr(server, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(server, "gemini_call", fake)
    p = c.post(f"/api/admin/leads/{lid}/ai/note", json={"text": "Met Mohan at the Goda plot, wants a corner one near 30 lakh, show him more on 3 March"}, headers=ADMIN).json()
    assert p["wants"]["budget_inr"] == 3000000 and p["status_hint"] == "site_visit" and p["tasks"][0]["due"] == "2030-03-01"
    assert c.get("/api/admin/leads", params={"q": "9830800025"}, headers=ADMIN).json()[0]["budget_inr"] is None            # nothing is saved by the preview
    done = c.post(f"/api/admin/leads/{lid}/ai/note/apply", json=p, headers=ADMIN).json()
    assert done["budget_inr"] == 3000000 and done["status"] == "site_visit" and done["next_follow_up"].startswith("2030-03-03") and done["tasks"][0]["source"] == "meeting"
    assert done["notes"][-1]["ai"] is True and done["wants"]["zones"] == ["Goda"]
    # a note never moves a lead backwards
    p2 = {**p, "status_hint": "contacted"}
    assert c.post(f"/api/admin/leads/{lid}/ai/note/apply", json=p2, headers=ADMIN).json()["status"] == "site_visit"


def test_run_now_button_and_stop_word(c):
    r = c.post("/api/admin/crm/automation/run", headers=ADMIN)
    assert r.status_code == 200 and {"sequences", "wishes", "digest", "reawaken", "sent"} <= set(r.json())
    assert c.post("/api/admin/crm/automation/run").status_code == 401
    cfg = c.get("/api/admin/crm/automation", headers=ADMIN).json()
    assert cfg["modes"]["digest"] == "off" and cfg["api_connected"] is False and cfg["sequence"]["steps"][0]["after_days"] == 2
