"""Lead intake: one door for every channel, auto-merge, spam filter, language, portal e-mails, IMAP, Meta, WhatsApp, missed calls, contacts, cards, speed coach.
    pytest backend/tests/test_crm_intake_offline.py -n 0"""
import asyncio
import hashlib
import hmac
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

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_intake", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="", TURNSTILE_SECRET_KEY="",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-intake-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import server  # noqa: E402
import crm_inbox  # noqa: E402
import _iso  # noqa: E402

ADMIN = {"Authorization": "Bearer in-admin"}
PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082")


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            await server.db.users.update_one({"email": "admin@example.com"}, {"$set": {"user_id": "ina", "name": "Ayan", "is_admin": True}}, upsert=True)
            await server.db.user_sessions.update_one({"session_token": "in-admin"}, {"$set": {"user_id": "ina", "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        before = client.portal.call(_iso.snapshot, server)
        yield client
        client.portal.call(_iso.restore, server, before)


def leads(c, **params):
    return c.get("/api/admin/leads", params=params, headers=ADMIN).json()


def test_same_person_from_three_portals_is_one_lead(c):
    async def go():
        a = await server.ingest_lead(name="Rahul Sen", phone="98300 70001", source="99acres", interest="3BHK Goda", message="Please call me")
        b = await server.ingest_lead(name="Rahul S", phone="+91 9830070001", source="magicbricks", message="Still looking")
        d = await server.ingest_lead(name=None, phone="9830070001", email="rahul@example.com", source="housing")
        return a, b, d
    a, b, d = c.portal.call(go)
    assert a["created"] and not b["created"] and not d["created"] and a["id"] == b["id"] == d["id"]
    lead = [l for l in leads(c, q="9830070001")][0]
    assert sorted(lead["sources"]) == ["99acres", "housing", "magicbricks"] and lead["email"] == "rahul@example.com"
    assert len(lead["notes"]) == 2 and [x["type"] for x in lead["activities"]].count("inquiry") == 2 and lead["last_inbound_at"]
    assert any("got in touch again" in n["title"] for n in c.get("/api/admin/notifications", headers=ADMIN).json()["items"])


def test_auto_merge_cleans_up_old_duplicates(c):
    async def go():
        for i, src in enumerate(("manual", "walk_in")):
            doc = server.Lead(name=f"Dup {i}", phone="+919830070002", source_page=src, tags=[src], notes=[{"id": f"n{i}", "text": f"note {i}", "author": "x", "created_at": "2026-01-01"}]).model_dump()
            doc["created_at"] = (datetime.now(timezone.utc) - timedelta(days=5 - i)).isoformat()
            doc["updated_at"] = doc["created_at"]
            await server.db.leads.insert_one(dict(doc))
        return await server.auto_merge_pass()
    assert c.portal.call(go) >= 1
    rows = leads(c, q="9830070002")
    assert len(rows) == 1 and {n["text"] for n in rows[0]["notes"]} == {"note 0", "note 1"} and set(rows[0]["tags"]) >= {"manual", "walk_in"}


def test_spam_is_caught_hidden_and_reversible(c):
    async def go():
        return [await server.ingest_lead(name="asdfgh", phone="9999999999", source="website", message="hello"),
                await server.ingest_lead(name="Real Roy", phone="9830070003", source="website", message="Buy bitcoin now http://spam.example"),
                await server.ingest_lead(name="Test", phone="9830070004", source="website"),
                await server.ingest_lead(name="Notif Test", phone="9830070005", source="website", message="I want a flat")]
    a, b, t, ok = c.portal.call(go)
    assert a["spam"] and b["spam"] and not t["spam"] and not ok["spam"]    # "Notif Test" is a real person; a bare "Test" is only suspicious
    assert "Not a real mobile number" in a["spam_reasons"]
    names = [l["name"] for l in leads(c)]
    assert "Real Roy" not in names and "Notif Test" in names                   # spam never shows in your lists
    spam = leads(c, tag="spam")
    assert {"Real Roy", "asdfgh"} <= {l["name"] for l in spam}
    assert "suspicious" in [l for l in leads(c, q="9830070004")][0]["tags"]
    sid = [l for l in spam if l["name"] == "Real Roy"][0]["id"]
    back = c.patch(f"/api/admin/leads/{sid}", json={"spam": False}, headers=ADMIN).json()
    assert back["spam"] is False and "spam" not in back["tags"]
    assert "Real Roy" in [l["name"] for l in leads(c)]
    assert c.get("/api/admin/crm/summary", headers=ADMIN).json()["total"] >= 1


def test_language_follows_the_script(c):
    assert server.detect_language("আমি তিন বেডরুমের ফ্ল্যাট চাই") == "bn" and server.detect_language("मुझे फ्लैट चाहिए") == "hi" and server.detect_language("need a flat") == "en"
    assert server.detect_language("ok") is None

    async def go():
        return await server.ingest_lead(name="Bengali Babu", phone="9830070006", source="whatsapp", message="আমি গোদায় একটা প্লট কিনতে চাই")
    r = c.portal.call(go)
    assert leads(c, q="9830070006")[0]["language"] == "bn" and r["created"]


def test_portal_email_webhook_reads_the_template_without_ai(c, monkeypatch):
    body = {"from": "leads@99acres.com", "subject": "New enquiry for your listing 3BHK Goda", "message_id": "<abc-1@99acres>",
            "text": "Hello,\nName: Anil Pal\nMobile: +91 98323 44556\nEmail: anil@example.com\nProperty: 3BHK Flat in Goda\nMessage: Is it still available?\n"}
    assert c.post("/api/inbox/email", json=body).status_code == 503
    monkeypatch.setattr(crm_inbox, "INBOX_SECRET", "inbox-secret")
    assert c.post("/api/inbox/email", json=body, headers={"X-Inbox-Key": "nope"}).status_code == 401
    ok = c.post("/api/inbox/email", json=body, headers={"X-Inbox-Key": "inbox-secret"})
    assert ok.status_code == 200 and ok.json()["leads"] == 1
    lead = leads(c, q="9832344556")[0]
    assert lead["source_page"] == "99acres" and lead["email"] == "anil@example.com" and "Goda" in lead["property_interest"] and "portal" in lead["tags"]
    assert c.post("/api/inbox/email", json=body, headers={"X-Inbox-Key": "inbox-secret"}).json()["leads"] == 0         # same e-mail twice is one lead
    inbox = c.get("/api/admin/crm/inbox", headers=ADMIN).json()
    assert inbox["items"][0]["channel"] in ("email", "whatsapp", "facebook", "missed_call") and inbox["channels"]["email_webhook"] is True


def test_portal_email_in_free_text_is_read_by_ai(c, monkeypatch):
    monkeypatch.setattr(crm_inbox, "INBOX_SECRET", "inbox-secret")
    monkeypatch.setattr(server, "GEMINI_API_KEY", "test-gemini-key")

    async def fake(prompt, system=None, **kw):
        return {"text": json.dumps({"people": [{"name": "Mita Das", "phone": "9830070007", "wants": {"property_type": "plot", "budget_inr": 2800000}, "summary": "Plot near Borehat"}]}), "sources": []}
    monkeypatch.setattr(server, "gemini_call", fake)
    r = c.post("/api/inbox/email", json={"from": "noreply@magicbricks.com", "subject": "Buyer interested", "message_id": "<free-2>", "text": "A buyer called Mita (9830070007) is looking at your plot, budget about 28 lakh."},
               headers={"X-Inbox-Key": "inbox-secret"})
    assert r.json()["leads"] == 1 and leads(c, q="9830070007")[0]["source_page"] == "magicbricks"
    assert leads(c, q="9830070007")[0]["wants"]["budget_inr"] == 2800000


def test_imap_mailbox_is_read_and_marked_seen(c, monkeypatch):
    raw = (b"From: 99acres <alerts@99acres.com>\r\nSubject: =?utf-8?q?New_lead?=\r\nMessage-ID: <imap-1@x>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n"
           b"Name: Tapas Kar\r\nPhone: 9830070008\r\nProperty: 2BHK Nawabhat\r\n")
    other = b"From: Mum <mum@gmail.com>\r\nSubject: dinner\r\nMessage-ID: <imap-2@x>\r\n\r\nhello\r\n"
    state = {"seen": []}

    class FakeIMAP:
        def __init__(self, host): pass
        def login(self, u, p): return "OK", []
        def select(self, f): return "OK", []
        def uid(self, cmd, *a):
            if cmd == "search":
                return "OK", [b"1 2"]
            if cmd == "fetch":
                return "OK", [(b"x", raw if a[0] == b"1" else other), b")"]
            if cmd == "store":
                state["seen"].append(a[0])
                return "OK", []
        def logout(self): return "BYE", []

    monkeypatch.setattr(crm_inbox.imaplib, "IMAP4_SSL", FakeIMAP)
    monkeypatch.setattr(crm_inbox, "IMAP_HOST", "imap.example.com")
    monkeypatch.setattr(crm_inbox, "IMAP_USER", "me@example.com")
    monkeypatch.setattr(crm_inbox, "IMAP_PASSWORD", "pw")
    assert c.portal.call(crm_inbox.imap_pass) == 1
    assert state["seen"] == [b"1"]                       # only the portal mail was touched, and it was marked read afterwards
    assert leads(c, q="9830070008")[0]["source_page"] == "99acres"


def sign(secret, body):
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_facebook_and_instagram_lead_forms(c, monkeypatch):
    monkeypatch.setattr(crm_inbox, "META_VERIFY_TOKEN", "vt")
    monkeypatch.setattr(crm_inbox, "META_APP_SECRET", "appsecret")
    monkeypatch.setattr(crm_inbox, "META_PAGE_TOKEN", "pagetoken")
    assert c.get("/api/inbox/meta", params={"hub.mode": "subscribe", "hub.verify_token": "vt", "hub.challenge": "12345"}).text == "12345"
    assert c.get("/api/inbox/meta", params={"hub.mode": "subscribe", "hub.verify_token": "bad", "hub.challenge": "1"}).status_code == 403

    async def graph(path, token):
        assert token == "pagetoken"
        return {"id": path, "platform": "ig", "field_data": [{"name": "full_name", "values": ["Sita Roy"]}, {"name": "phone_number", "values": ["+919830070009"]},
                                                              {"name": "email", "values": ["sita@example.com"]}, {"name": "what_are_you_looking_for", "values": ["2BHK"]}]}
    monkeypatch.setattr(crm_inbox, "graph_get", graph)
    body = json.dumps({"entry": [{"changes": [{"field": "leadgen", "value": {"leadgen_id": "L-1"}}]}]}).encode()
    assert c.post("/api/inbox/meta", content=body, headers={"X-Hub-Signature-256": "sha256=bad"}).status_code == 401
    r = c.post("/api/inbox/meta", content=body, headers={"X-Hub-Signature-256": sign("appsecret", body)})
    assert r.status_code == 200 and r.json()["leads"] == 1
    lead = leads(c, q="9830070009")[0]
    assert lead["source_page"] == "instagram" and "what are you looking for: 2BHK" in lead["message"] and "ad" in lead["tags"]
    assert c.post("/api/inbox/meta", content=body, headers={"X-Hub-Signature-256": sign("appsecret", body)}).json()["leads"] == 0       # not twice


def test_whatsapp_messages_become_leads_and_a_conversation(c, monkeypatch):
    monkeypatch.setattr(crm_inbox, "WHATSAPP_VERIFY_TOKEN", "wvt")
    monkeypatch.setattr(crm_inbox, "WHATSAPP_APP_SECRET", "wsecret")
    assert c.get("/api/inbox/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "wvt", "hub.challenge": "777"}).text == "777"
    msg = {"entry": [{"changes": [{"value": {"contacts": [{"wa_id": "919830070010", "profile": {"name": "Bapi Dey"}}],
                                             "messages": [{"from": "919830070010", "id": "wamid.1", "type": "text", "text": {"body": "আমার একটা ফ্ল্যাট দরকার"}},
                                                          {"from": "919830070010", "id": "wamid.2", "type": "audio", "audio": {"id": "m1"}}]}}]}]}
    body = json.dumps(msg).encode()
    assert c.post("/api/inbox/whatsapp", content=body, headers={"X-Hub-Signature-256": "sha256=x"}).status_code == 401
    r = c.post("/api/inbox/whatsapp", content=body, headers={"X-Hub-Signature-256": sign("wsecret", body)})
    assert r.json()["messages"] == 2
    lead = leads(c, q="9830070010")[0]
    assert lead["name"] == "Bapi Dey" and lead["language"] == "bn" and lead["source_page"] == "whatsapp"
    assert [m["text"] for m in c.portal.call(lambda: server.db.messages.find({"lead_id": lead["id"]}).to_list(10))] == ["আমার একটা ফ্ল্যাট দরকার", "[voice message]"]
    assert c.post("/api/inbox/whatsapp", content=body, headers={"X-Hub-Signature-256": sign("wsecret", body)}).json()["messages"] == 0


def test_missed_call_becomes_a_hot_lead_with_a_callback(c, monkeypatch):
    body = {"from": "+91 98300 70011", "to": "+919933333333", "at": "2026-10-07T10:15:00+05:30", "call_id": "MC1"}
    assert c.post("/api/calls/missed", json=body).status_code == 503
    monkeypatch.setattr(server, "CALL_WEBHOOK_SECRET", "hook")
    assert c.post("/api/calls/missed", json=body, headers={"X-Webhook-Key": "bad"}).status_code == 401
    r = c.post("/api/calls/missed", json=body, headers={"X-Webhook-Key": "hook"})
    assert r.status_code == 202 and r.json()["lead_id"]
    lead = leads(c, q="9830070011")[0]
    assert lead["source_page"] == "missed_call" and lead["priority"] == "hot" and lead["next_follow_up"] and "Call back" in lead["follow_up_note"]
    assert c.post("/api/calls/missed", json=body, headers={"X-Webhook-Key": "hook"}).json().get("duplicate") is True


def test_phone_contacts_and_vcf_import(c):
    vcf = "BEGIN:VCARD\nVERSION:3.0\nFN:Dilip Ghosh\nTEL;TYPE=CELL:+91 98300 70012\nEMAIL:dilip@example.com\nORG:Ghosh Builders\nEND:VCARD\nBEGIN:VCARD\nFN:No Number\nEND:VCARD\n"
    r = c.post("/api/admin/crm/contacts/import", json={"contacts": [{"name": "Gita Pal", "tel": ["98300 70013"], "email": [], "note": "plot owner"}, {"name": "Nobody", "tel": []}],
                                                       "vcf": vcf, "met": "Bardhaman Fair 2026", "note": "met at the property fair"}, headers=ADMIN)
    assert r.status_code == 200 and r.json() == {"created": 2, "merged": 0, "skipped": 2}
    d = leads(c, q="9830070012")[0]
    assert d["name"] == "Dilip Ghosh" and "bardhaman-fair-2026" in d["tags"] and "imported" in d["tags"] and d["source_page"] == "met:bardhaman-fair-2026"
    assert c.post("/api/admin/crm/contacts/import", json={"contacts": []}, headers=ADMIN).status_code == 422
    # no first-reply alert for people you merely imported
    assert not any("Gita" in n["title"] for n in c.get("/api/admin/notifications", headers=ADMIN).json()["items"])


def test_business_card_photo_uses_the_card_prompt(c, monkeypatch):
    seen = {}

    async def fake(prompt, system=None, **kw):
        seen["prompt"] = prompt
        return {"text": json.dumps({"people": [{"name": "Arup Basu", "phone": "9830070014", "email": "arup@bank.example", "notes": "Branch manager, State Bank"}]}), "sources": []}
    monkeypatch.setattr(server, "GEMINI_API_KEY", "test-gemini-key")
    monkeypatch.setattr(server, "gemini_call", fake)
    r = c.post("/api/admin/crm/ai/notes", files=[("files", ("card.png", PNG, "image/png"))], data={"kind": "card"}, headers=ADMIN)
    assert r.status_code == 200 and r.json()["people"][0]["email"] == "arup@bank.example" and "visiting (business) cards" in seen["prompt"]


def test_translate_between_languages(c, monkeypatch):
    async def fake(prompt, system=None, **kw):
        return {"text": json.dumps({"text": "নমস্কার, আপনার ফ্ল্যাটটি এখনও খালি আছে।"}), "sources": []}
    monkeypatch.setattr(server, "GEMINI_API_KEY", "test-gemini-key")
    monkeypatch.setattr(server, "gemini_call", fake)
    r = c.post("/api/admin/crm/translate", json={"text": "Hello, your flat is still available.", "to": "bn"}, headers=ADMIN)
    assert r.json()["text"].startswith("নমস্কার") and c.post("/api/admin/crm/translate", json={"text": "x", "to": "fr"}, headers=ADMIN).status_code == 422


def test_speed_coach_alerts_after_five_minutes(c):
    async def go():
        r = await server.ingest_lead(name="Quick Query", phone="9830070015", source="website", message="price?")
        await server.db.leads.update_one({"id": r["id"]}, {"$set": {"created_at": (datetime.now(timezone.utc) - timedelta(minutes=6)).isoformat()}})
        fresh = await server.ingest_lead(name="Just Now", phone="9830070016", source="website", message="hi there")
        await server.crm_pass()
        await server.crm_pass()
        return r["id"], fresh["id"]
    old, fresh = c.portal.call(go)
    titles = [n["title"] for n in c.get("/api/admin/notifications", headers=ADMIN).json()["items"]]
    assert sum("Quick Query has been waiting" in t for t in titles) == 1 and not any("Just Now has been waiting" in t for t in titles)


def test_phone_app_upload_needs_the_key_and_a_real_recording(monkeypatch):
    """The Call Sync app posts each new recording: key required, formats checked, same file twice is harmless."""
    monkeypatch.setattr(server, "CALL_WEBHOOK_SECRET", "phone-secret")
    monkeypatch.setattr(server, "gemini_enabled", lambda: True)
    seen = []

    async def fake_process(audio, meta):
        seen.append(meta)
        return {"id": "x"}
    monkeypatch.setattr(server, "process_call", fake_process)
    mp3 = b"ID3" + b"\x00" * 300
    with TestClient(server.app) as c:
        files = {"file": ("Call_9831012345_incoming.mp3", mp3, "audio/mpeg")}
        assert c.post("/api/calls/device-upload", files=files).status_code == 401
        assert c.post("/api/calls/device-upload", files=files, headers={"X-Webhook-Key": "wrong"}).status_code == 401
        bad = c.post("/api/calls/device-upload", files={"file": ("a.amr", b"#!AMR\n" + b"1" * 50, "audio/amr")}, headers={"X-Webhook-Key": "phone-secret"})
        assert bad.status_code == 415
        ok = c.post("/api/calls/device-upload", files=files, data={"direction": "incoming"}, headers={"X-Webhook-Key": "phone-secret"})
        assert ok.status_code == 202 and ok.json()["accepted"] is True
        c.portal.call(asyncio.sleep, 0.3)
        assert seen and seen[0]["phone"] == "+919831012345" and seen[0]["source"] == "phone_app"
