"""CRM AI: handwritten notes, voice text, call recordings (upload, webhook, Google Drive), smart filter, listing matches, owner lead view.
    pytest backend/tests/test_crm_ai_offline.py -n 0"""
import asyncio
import base64
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

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_crmai", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="", TURNSTILE_SECRET_KEY="",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-crmai-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

ADMIN = {"Authorization": "Bearer cai-admin"}
OWNER = {"Authorization": "Bearer cai-owner"}
PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082")
MP3 = b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\x00" * 200
M4A = b"\x00\x00\x00\x18ftypM4A " + b"\x01" * 300


TOUCHED = ("properties", "leads", "videos", "call_logs", "listing_matches", "notifications", "contacts", "interests", "listing_payments", "contacts", "visits")


async def snapshot():
    return {name: {str(d["_id"]) async for d in server.db[name].find({}, {"_id": 1})} for name in TOUCHED}


async def restore(before):
    for name, ids in before.items():
        async for d in server.db[name].find({}, {"_id": 1}):
            if str(d["_id"]) not in ids:
                await server.db[name].delete_one({"_id": d["_id"]})
    await server.db.settings.delete_many({"_id": {"$in": ["listing_settings", "drive_calls"]}})


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            for uid, email, tok, admin in (("caia", "admin@example.com", "cai-admin", True), ("caio", "owner-cai@example.com", "cai-owner", False)):
                await server.db.users.update_one({"email": email}, {"$set": {"user_id": uid, "name": "Sumit Banerjee" if not admin else "Ayan", "is_admin": admin}}, upsert=True)
                await server.db.user_sessions.update_one({"session_token": tok}, {"$set": {"user_id": uid, "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        before = client.portal.call(snapshot)
        yield client
        client.portal.call(restore, before)      # the test files share one database: leave it as we found it


def fake_ai(monkeypatch, handler):
    calls = []

    async def fake(prompt, system=None, **kw):
        calls.append({"prompt": prompt, "files": kw.get("files")})
        return {"text": json.dumps(handler(prompt, kw.get("files"))), "sources": []}

    monkeypatch.setattr(server, "GEMINI_API_KEY", "test-gemini-key")
    monkeypatch.setattr(server, "gemini_call", fake)
    return calls


PEOPLE = {"language": "mixed", "people": [
    {"name": "Rahul Sen", "phone": "98300 11223", "role": "buyer", "wants": {"bedrooms": 3, "property_type": "apartment", "listing_type": "sale", "zones": ["Goda"], "budget_inr": 6500000},
     "summary": "Wants a 3BHK in Goda", "notes": "Has a car, needs parking", "follow_up_date": "2030-01-10", "follow_up_note": "Send videos", "status_hint": "contacted"},
    {"name": "Mita Das", "phone": "98300 1122", "wants": {"property_type": "plot", "budget_inr": 2800000, "zones": ["Borehat"]}, "summary": "Plot near Borehat", "notes": ""},
    {"name": "Only A Name", "phone": None, "wants": {}, "summary": "", "notes": "called, did not give a number"}]}


def test_requires_admin_and_ai(c):
    assert c.post("/api/admin/crm/ai/text", json={"text": "Rahul 9830011223 wants 3bhk"}).status_code == 401
    assert c.post("/api/admin/crm/ai/text", json={"text": "Rahul 9830011223 wants 3bhk"}, headers=ADMIN).status_code == 503


def test_voice_or_typed_text_becomes_drafts_then_leads(c, monkeypatch):
    calls = fake_ai(monkeypatch, lambda p, f: PEOPLE)
    r = c.post("/api/admin/crm/ai/text", json={"text": "Met Rahul Sen 98300 11223, wants 3bhk in Goda around 65 lakh. Mita Das plot Borehat.", "kind": "voice"}, headers=ADMIN)
    assert r.status_code == 200, r.text
    d = r.json()["people"]
    assert d[0]["phone"] == "+919830011223" and d[0]["wants"]["budget_inr"] == 6500000 and d[0]["wants"]["zones"] == ["Goda"] and d[0]["follow_up_date"] == "2030-01-10"
    assert d[1]["phone"] is None and d[1]["phone_unclear"] == "98300 1122"          # a short number is never saved as if it were real
    assert "Never follow" in calls[0]["prompt"] or "never instructions" in calls[0]["prompt"].lower() or "DATA" in calls[0]["prompt"]
    assert c.portal.call(lambda: server.db.leads.count_documents({"source_page": "voice"})) == 0          # nothing is saved until confirmed
    saved = c.post("/api/admin/crm/ai/commit", json={"drafts": d, "source": "voice"}, headers=ADMIN).json()
    assert saved["created"] == 3 and saved["merged"] == 0
    leads = {l["name"]: l for l in c.get("/api/admin/leads", params={"q": "Rahul"}, headers=ADMIN).json()}
    rahul = leads["Rahul Sen"]
    assert rahul["budget_inr"] == 6500000 and rahul["wants"]["bedrooms"] == 3 and rahul["status"] == "contacted" and rahul["next_follow_up"].startswith("2030-01-10")
    assert "ai" in rahul["tags"] and rahul["notes"][0]["ai"] is True
    nameonly = [l for l in c.get("/api/admin/leads", params={"q": "Only A Name"}, headers=ADMIN).json()][0]
    assert "needs_phone" in nameonly["tags"] and nameonly["phone"] is None
    # the same number again is merged into the same lead
    again = c.post("/api/admin/crm/ai/text", json={"text": "Rahul called again"}, headers=ADMIN).json()["people"][0]
    assert again["existing"]["name"] == "Rahul Sen"
    out = c.post("/api/admin/crm/ai/commit", json={"drafts": [again], "source": "typed"}, headers=ADMIN).json()
    assert out["merged"] >= 1 and len([l for l in c.get("/api/admin/leads", params={"q": "9830011223"}, headers=ADMIN).json()]) == 1


def test_handwritten_notes_photo_goes_to_the_model(c, monkeypatch):
    calls = fake_ai(monkeypatch, lambda p, f: {"people": [{"name": "Sk Rafik", "phone": "9733455566", "wants": {"property_type": "commercial", "budget_inr": 9000000}, "summary": "Shop on GT Road"}]})
    r = c.post("/api/admin/crm/ai/notes", files=[("files", ("notes.png", PNG, "image/png"))], headers=ADMIN)
    assert r.status_code == 200 and r.json()["people"][0]["phone"] == "+919733455566"
    assert calls[0]["files"][0][0] == "image/png"
    assert c.post("/api/admin/crm/ai/notes", files=[("files", ("x.png", b"not an image", "image/png"))], headers=ADMIN).status_code == 415


def test_recording_file_name_parsing():
    assert server.parse_recording_name("Call with Priya Roy +91 98301 55667_20261003_101500.m4a") == {"phone": "+919830155667", "name": "Priya Roy"}
    assert server.parse_recording_name("Incoming_9830155667_20261003.mp3") == {"phone": "+919830155667", "direction": "incoming"}
    assert server.parse_recording_name("recording_20261003.mp3") == {}
    assert server.sniff_audio(MP3) == "audio/mp3" and server.sniff_audio(M4A) == "audio/mp4" and server.sniff_audio(b"#!AMR\n123456") is None


CALL = {"is_business_call": True, "language": "bn", "caller_name": "Tapan Ghosh", "caller_phone": None, "intent": "buy", "summary": "Wants a 2BHK flat near DVC More under 40 lakh and will visit on Sunday.",
        "wants": {"bedrooms": 2, "property_type": "apartment", "budget_inr": 4000000, "zones": ["DVC More"]}, "action_items": ["Send flat videos", "Book Sunday visit"],
        "follow_up_date": "2030-02-02", "follow_up_note": "Confirm the visit", "sentiment": "keen", "transcript": "Caller: ... Ayan: ..."}


def test_call_recording_upload_creates_lead_and_timeline(c, monkeypatch):
    calls = fake_ai(monkeypatch, lambda p, f: CALL)
    r = c.post("/api/admin/crm/calls/upload", files=[("files", ("Call with Tapan 98311 22334_20261004.m4a", M4A, "audio/mp4"))], headers=ADMIN)
    assert r.status_code == 200, r.text
    res = r.json()["results"][0]
    assert res["created"] is True and res["phone"] == "+919831122334" and res["name"] == "Tapan"
    lead = [l for l in c.get("/api/admin/leads", params={"q": "9831122334"}, headers=ADMIN).json()][0]
    assert lead["wants"]["budget_inr"] == 4000000 and lead["status"] == "contacted" and lead["first_contacted_at"] and "call" in lead["tags"]
    assert any(a["type"] == "call" and "2BHK flat near DVC More" in a["text"] for a in lead["activities"]) and lead["next_follow_up"].startswith("2030-02-02")
    assert any("Send flat videos" in n["text"] for n in lead["notes"])
    assert calls[0]["files"][0][0] == "audio/mp4" and "98311 22334" not in calls[0]["prompt"] and "+919831122334" in calls[0]["prompt"]
    log = c.get("/api/admin/crm/calls", headers=ADMIN).json()["items"][0]
    assert log["lead_name"] == "Tapan" and log["intent"] == "buy" and "transcript" not in log
    full = c.get(f"/api/admin/crm/calls/{log['id']}/transcript", headers=ADMIN).json()
    assert full["transcript"].startswith("Caller")
    # the same recording twice is not processed twice
    again = c.post("/api/admin/crm/calls/upload", files=[("files", ("copy.m4a", M4A, "audio/mp4"))], headers=ADMIN).json()["results"][0]
    assert again["duplicate"] is True and len(calls) == 1


def test_personal_calls_and_bad_files_are_not_kept(c, monkeypatch):
    fake_ai(monkeypatch, lambda p, f: {**CALL, "is_business_call": False})
    other = M4A + b"personal"
    res = c.post("/api/admin/crm/calls/upload", files=[("files", ("a.m4a", other, "audio/mp4")), ("files", ("b.amr", b"#!AMR\nxxxxxxxxxxxx", "audio/amr"))], headers=ADMIN).json()["results"]
    assert res[0]["ignored"] is True and "Unsupported" in res[1]["error"]
    logs = c.portal.call(lambda: server.db.call_logs.find_one({"status": "ignored"}))
    assert logs and "transcript" not in logs and "summary" not in logs
    assert c.post("/api/admin/crm/calls/upload", files=[("files", ("x.m4a", M4A, "audio/mp4"))], data={"phone": "123"}, headers=ADMIN).status_code == 422


def test_phone_system_webhook(c, monkeypatch):
    body = {"call_id": "EX123", "from": "+91 98322 33445", "to": "+91 99333 33333", "direction": "incoming", "recording_url": "https://calls.example.com/rec/EX123.mp3", "duration": 95}
    assert c.post("/api/calls/webhook", json=body).status_code == 503                        # not set up yet
    monkeypatch.setattr(server, "CALL_WEBHOOK_SECRET", "s3cret-hook")
    assert c.post("/api/calls/webhook", json=body).status_code == 401
    assert c.post("/api/calls/webhook", json=body, headers={"X-Webhook-Key": "wrong"}).status_code == 401
    fake_ai(monkeypatch, lambda p, f: CALL)
    assert c.post("/api/calls/webhook", json={**body, "recording_url": "http://10.0.0.1/x.mp3"}, headers={"X-Webhook-Key": "s3cret-hook"}).status_code == 422
    assert c.post("/api/calls/webhook", json={**body, "recording_url": "https://127.0.0.1/x.mp3"}, headers={"X-Webhook-Key": "s3cret-hook"}).status_code == 422
    assert c.post("/api/calls/webhook", json=body, headers={"X-Webhook-Key": "s3cret-hook"}).status_code == 202

    async def fetch(url):
        return M4A + b"webhook"
    monkeypatch.setattr(server, "fetch_recording", fetch)
    c.portal.call(server.run_webhook_call, {"call_id": "EX124", "from_number": "+91 98322 33445", "to_number": "+91 99333 33333", "direction": "incoming", "recording_url": "https://calls.example.com/x.mp3"})
    lead = c.get("/api/admin/leads", params={"q": "9832233445"}, headers=ADMIN).json()[0]
    assert lead["phone"] == "+919832233445" and any(a["type"] == "call" for a in lead["activities"])      # the customer's number, not the business number


def test_google_drive_folder_is_listened_to(c, monkeypatch):
    fake_ai(monkeypatch, lambda p, f: {**CALL, "caller_name": "Drive Dutta"})
    monkeypatch.setattr(server, "drive_configured", lambda: True)
    files = [{"id": "F1", "name": "Call with Drive Dutta 98344 55667_20261004.m4a", "mimeType": "audio/mp4", "size": "300", "createdTime": "2026-10-04T10:00:00Z"},
             {"id": "F2", "name": "notes.txt", "mimeType": "text/plain", "size": "10"},
             {"id": "F3", "name": "big.mp3", "mimeType": "audio/mpeg", "size": str(20 * 1024 * 1024)}]

    async def listing():
        return files

    async def download(fid):
        return M4A + fid.encode()

    monkeypatch.setattr(server, "drive_list_files", listing)
    monkeypatch.setattr(server, "drive_download", download)
    first = c.portal.call(server.drive_pass)
    assert first["processed"] == 1 and first["checked"] == 3
    lead = c.get("/api/admin/leads", params={"q": "9834455667"}, headers=ADMIN).json()[0]
    assert lead["phone"] == "+919834455667" and any("Google Drive" in str(a) or a["type"] == "call" for a in lead["activities"])
    assert c.portal.call(server.drive_pass)["processed"] == 0                                    # nothing new, nothing repeated
    big = c.portal.call(lambda: server.db.call_logs.find_one({"source_key": "drive:F3"}))
    assert big["status"] == "failed" and "14 MB" in big["error"] and big["attempts"] == 2         # one try per pass
    for _ in range(3):
        c.portal.call(server.drive_pass)
    assert c.portal.call(lambda: server.db.call_logs.find_one({"source_key": "drive:F3"}))["attempts"] == 3          # gives up after three tries
    st = c.get("/api/admin/crm/calls", headers=ADMIN).json()["drive"]
    assert st["configured"] is True and st["failed"] >= 1


def test_drive_sign_in_builds_a_valid_signed_token(monkeypatch):
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding, rsa
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
    monkeypatch.setattr(server, "GOOGLE_SERVICE_ACCOUNT_JSON", json.dumps({"client_email": "bot@proj.iam.gserviceaccount.com", "private_key": pem, "token_uri": "https://oauth2.example/token"}))
    sent = {}

    class FakeClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, data=None, **k):
            sent.update(url=url, data=data)

            class R:
                status_code = 200
                def json(self): return {"access_token": "tok-123", "expires_in": 3600}
            return R()

    monkeypatch.setattr(server.httpx, "AsyncClient", FakeClient)
    server._drive_token.update(value=None, exp=0)
    assert asyncio.run(server.drive_access_token()) == "tok-123"
    head, claims, sig = sent["data"]["assertion"].split(".")
    pad = lambda s: s + "=" * (-len(s) % 4)
    assert json.loads(base64.urlsafe_b64decode(pad(head))) == {"alg": "RS256", "typ": "JWT"}
    cl = json.loads(base64.urlsafe_b64decode(pad(claims)))
    assert cl["iss"] == "bot@proj.iam.gserviceaccount.com" and cl["scope"].endswith("drive.readonly") and cl["exp"] > cl["iat"]
    key.public_key().verify(base64.urlsafe_b64decode(pad(sig)), f"{head}.{claims}".encode(), padding.PKCS1v15(), hashes.SHA256())     # raises if the signature is wrong
    server._drive_token.update(value=None, exp=0)


def test_smart_filter_with_and_without_ai(c, monkeypatch):
    for n, ph, extra in (("Hot Buyer", "9830400001", {"budget_inr": 5000000, "priority": "hot", "wants": {"property_type": "apartment", "bedrooms": 3, "zones": ["Goda"]}}),
                         ("Plot Person", "9830400002", {"budget_inr": 2000000, "wants": {"property_type": "plot"}})):
        lid = c.post("/api/admin/leads", json={"name": n, "phone": ph, "source_page": "magicbricks"}, headers=ADMIN).json()["id"]
        c.patch(f"/api/admin/leads/{lid}", json=extra, headers=ADMIN)
    fake_ai(monkeypatch, lambda p, f: {"filters": {"temperature": ["hot"], "budget_min": 4000000, "property_type": "apartment", "sources": ["magicbricks"], "status": ["bogus"], "evil": "x"},
                                       "sort": "score", "explain": "Hot apartment buyers with a budget over 40 lakh from MagicBricks"})
    r = c.post("/api/admin/crm/ai/filter", json={"query": "hot flat buyers above 40 lakh from magicbricks"}, headers=ADMIN).json()
    assert r["mode"] == "ai" and [m["name"] for m in r["matches"]] == ["Hot Buyer"]
    assert r["filters"]["status"] == [] and "evil" not in r["filters"] and r["filters"]["temperature"] == ["hot"]        # junk from the model is dropped
    monkeypatch.setattr(server, "GEMINI_API_KEY", "")
    k = c.post("/api/admin/crm/ai/filter", json={"query": "plot under 30 lakh"}, headers=ADMIN).json()
    assert k["mode"] == "keywords" and "Plot Person" in [m["name"] for m in k["matches"]] and "Hot Buyer" not in [m["name"] for m in k["matches"]]
    assert c.post("/api/admin/crm/ai/filter", json={"query": "x"}, headers=ADMIN).status_code == 422


def test_pricing_a_listing_shortlists_customers(c):
    def lead(name, phone, **kw):
        lid = c.post("/api/admin/leads", json={"name": name, "phone": phone, "source_page": "99acres"}, headers=ADMIN).json()["id"]
        c.patch(f"/api/admin/leads/{lid}", json=kw, headers=ADMIN)
        return lid
    good = lead("Good Fit", "9830500001", budget_inr=4500000, wants={"property_type": "apartment", "bedrooms": 2, "zones": ["Nawabhat"]})
    close = lead("Close Budget", "9830500002", budget_inr=3300000, wants={"property_type": "apartment"})
    poor = lead("Too Poor", "9830500003", budget_inr=1000000, wants={"property_type": "apartment"})
    wrong = lead("Wants Plot", "9830500004", budget_inr=4500000, wants={"property_type": "plot"})
    done = lead("Already Bought", "9830500005", budget_inr=4500000, wants={"property_type": "apartment"})
    c.patch(f"/api/admin/leads/{done}", json={"status": "closed"}, headers=ADMIN)
    prop = c.post("/api/admin/properties", json={"title": "2BHK in Nawabhat", "zone": "Nawabhat", "property_type": "apartment", "bedrooms": 2, "area_sqft": 900, "price_inr": 4000000,
                                                 "description": "Nice flat", "image": "https://example.com/a.jpg"}, headers=ADMIN).json()
    m = c.get(f"/api/admin/crm/matches/property/{prop['id']}", headers=ADMIN).json()
    names = [x["name"] for x in m["matches"]]
    assert names[0] == "Good Fit" and "Close Budget" in names and "Too Poor" not in names and "Wants Plot" not in names and "Already Bought" not in names
    assert "Budget fits" in m["matches"][0]["match_reasons"] and any("Nawabhat" in r for r in m["matches"][0]["match_reasons"])
    rec = [x for x in c.get("/api/admin/crm/matches", headers=ADMIN).json() if x["item_id"] == prop["id"]][0]          # stored when the listing was priced
    assert rec["count"] >= 2 and good in rec["lead_ids"]
    notes = c.get("/api/admin/notifications", headers=ADMIN).json()["items"]
    assert any(n["kind"] == "matches" and "may want 2BHK in Nawabhat" in n["title"] and "match=property:" in n["link"] for n in notes)
    # no price, no matches
    free = c.post("/api/admin/properties", json={"title": "No price plot", "zone": "Goda", "property_type": "plot", "area_sqft": 900, "description": "x", "image": "https://example.com/b.jpg"}, headers=ADMIN).json()
    assert c.get(f"/api/admin/crm/matches/property/{free['id']}", headers=ADMIN).json()["matches"] == []
    # pricing a YouTube video does the same
    c.portal.call(lambda: server.db.videos.insert_one({"video_id": "MATCHVID001", "title": "2BHK Nawabhat flat", "zone": "Nawabhat", "property_type": "apartment", "bedrooms": 2,
                                                       "published_at": "2026-10-01T00:00:00+00:00", "locked_fields": []}))
    assert c.patch("/api/admin/videos/MATCHVID001", json={"price_inr": 4200000}, headers=ADMIN).status_code == 200
    vm = c.get("/api/admin/crm/matches/video/MATCHVID001", headers=ADMIN).json()
    assert vm["matches"][0]["name"] == "Good Fit"
    assert c.get("/api/admin/crm/matches/video/NOPE", headers=ADMIN).status_code == 404


def test_owner_sees_interested_people_when_paid(c):
    c.put("/api/admin/listing-settings", json={"upi_id": "ayan@oksbi"}, headers=ADMIN)
    mine = c.post("/api/owner/listings", json={"title": "Owner plot", "zone": "Goda", "property_type": "plot", "area_sqft": 1800, "description": "Corner", "phone": "9830600001", "accepted_terms": True}, headers=OWNER).json()
    pid = mine["id"]

    async def seed():
        now = datetime.now(timezone.utc).isoformat()
        await server.db.contacts.insert_one({"id": "ct_cai1", "name": "Interested Ira", "phone": "+919830600002", "phone_key": "9830600002"})
        await server.db.interests.insert_one({"id": "int_cai1", "contact_id": "ct_cai1", "item_type": "property", "item_id": pid, "title": "Owner plot", "count": 2, "created_at": now, "last_at": now})
    c.portal.call(seed)
    locked = c.get(f"/api/owner/listings/{pid}/leads", headers=OWNER).json()
    assert locked == {"locked": True, "count": 1, "people": []}                   # free days: they see how many, not who
    c.post(f"/api/owner/listings/{pid}/payment", json={"plan_id": "30", "utr": "992345678901"}, headers=OWNER)
    c.post(f"/api/admin/listings/{pid}/confirm", json={}, headers=ADMIN)
    open_ = c.get(f"/api/owner/listings/{pid}/leads", headers=OWNER).json()
    assert open_["locked"] is False and open_["people"][0]["name"] == "Interested Ira" and open_["people"][0]["phone"] == "+919830600002"
    assert c.get(f"/api/owner/listings/{pid}/leads").status_code == 401
    assert c.get(f"/api/owner/listings/{pid}/leads", headers=ADMIN).status_code == 404              # only the owner
    # Ayan can always see them, and may open it up for everyone
    assert c.put("/api/admin/listing-settings", json={"leads_unlock": "always"}, headers=ADMIN).json()["leads_unlock"] == "always"
