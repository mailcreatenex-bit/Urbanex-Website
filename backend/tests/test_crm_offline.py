"""CRM: manual leads, call/WhatsApp logging, follow-ups, scoring, import, merge, bulk, summary, AI.
    pytest backend/tests/test_crm_offline.py -n 0"""
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_crm", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-crm-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

ADMIN = {"Authorization": "Bearer crm-admin"}


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            await server.db.users.update_one({"email": "admin@example.com"}, {"$set": {"user_id": "crm1", "name": "A", "is_admin": True}}, upsert=True)
            await server.db.user_sessions.update_one({"session_token": "crm-admin"}, {"$set": {"user_id": "crm1", "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        yield client


def add(c, **kw):
    body = {"name": "Rahul Sen", "phone": "9830012345", "source_page": "99acres", "property_interest": "2BHK in Goda", **kw}
    return c.post("/api/admin/leads", json=body, headers=ADMIN)


def test_requires_admin(c):
    assert c.get("/api/admin/crm/summary").status_code == 401
    assert c.post("/api/admin/leads", json={"name": "x", "phone": "9830012345"}).status_code == 401


def test_add_by_hand_and_duplicate_guard(c):
    r = add(c)
    assert r.status_code == 200, r.text
    lead = r.json()
    assert lead["phone"] == "+919830012345" and lead["phone_key"] == "9830012345" and lead["status"] == "new"
    assert lead["activities"][0]["type"] == "created" and lead["temperature"] in ("hot", "warm", "cold")
    dup = add(c, name="Rahul again")
    assert dup.status_code == 409 and dup.json()["detail"]["lead_id"] == lead["id"]
    assert add(c, name="Rahul again", force=True).status_code == 200
    assert c.post("/api/admin/leads", json={"name": "No contact"}, headers=ADMIN).status_code == 422
    assert c.post("/api/admin/leads", json={"name": "Fake", "phone": "9999999999"}, headers=ADMIN).status_code == 422


def test_call_and_whatsapp_logging_moves_the_lead_and_sets_follow_up(c):
    lead = add(c, name="Priya Das", phone="9830055555").json()
    r = c.post(f"/api/admin/leads/{lead['id']}/activity", json={"type": "call", "outcome": "no_answer"}, headers=ADMIN).json()
    assert r["status"] == "contacted" and r["first_contacted_at"] and r["last_contacted_at"]
    assert r["next_follow_up"] and r["follow_up_overdue"] is False                       # nobody answered: try again tomorrow 9 AM
    kinds = [a["type"] for a in r["activities"]]
    assert kinds.count("call") == 1 and "status" in kinds and "follow_up" in kinds
    w = c.post(f"/api/admin/leads/{lead['id']}/activity", json={"type": "whatsapp", "text": "sent the visit invite", "follow_up_in_days": 3}, headers=ADMIN).json()
    assert w["activities"][-2]["type"] == "whatsapp" and w["next_follow_up"] > r["next_follow_up"]
    bad = c.post(f"/api/admin/leads/{lead['id']}/activity", json={"type": "fax"}, headers=ADMIN)
    assert bad.status_code == 422
    wrong = add(c, name="Wrong", phone="9830066666").json()
    w2 = c.post(f"/api/admin/leads/{wrong['id']}/activity", json={"type": "call", "outcome": "wrong_number"}, headers=ADMIN).json()
    assert w2["status"] == "new" and "wrong_number" in w2["tags"]


def test_follow_up_filters_status_history_and_clearing(c):
    lead = add(c, name="Follow Me", phone="9830077777").json()
    past = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
    r = c.patch(f"/api/admin/leads/{lead['id']}", json={"next_follow_up": past, "follow_up_note": "Call about the plot", "priority": "hot", "budget_inr": 4500000}, headers=ADMIN).json()
    assert r["follow_up_overdue"] is True and r["temperature"] == "hot" and r["budget_inr"] == 4500000
    overdue = [l["id"] for l in c.get("/api/admin/leads", params={"follow_up": "overdue"}, headers=ADMIN).json()]
    assert lead["id"] in overdue
    assert lead["id"] in [l["id"] for l in c.get("/api/admin/leads", params={"temperature": "hot"}, headers=ADMIN).json()]
    cleared = c.patch(f"/api/admin/leads/{lead['id']}", json={"next_follow_up": None, "priority": None}, headers=ADMIN).json()
    assert cleared["next_follow_up"] is None and cleared["follow_up_overdue"] is False
    closed = c.patch(f"/api/admin/leads/{lead['id']}", json={"status": "closed", "deal_value_inr": 4200000}, headers=ADMIN).json()
    assert closed["closed_at"] and closed["score"] == 100 and closed["activities"][-1]["text"] == "new → closed"
    date_only = c.patch(f"/api/admin/leads/{add(c, name='D', phone='9830088888').json()['id']}", json={"next_follow_up": "2030-01-05"}, headers=ADMIN).json()
    assert date_only["next_follow_up"].startswith("2030-01-05T03:30")                      # 9 AM India time


def test_score_reflects_engagement():
    base = {"status": "new", "phone_key": "9830012345", "created_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}
    cold = server.lead_score({**base, "phone_key": "", "flags": ["device_many_numbers"]})
    warm = server.lead_score({**base, "notes": [{"text": "Interested in video: X"}, {"text": "Interested in property: Y"}]}, visits=1)
    assert warm["score"] > cold["score"] and warm["temperature"] == "hot" and cold["temperature"] == "cold"
    assert server.lead_score({**base, "status": "lost"})["score"] == 0


def test_import_portal_csv_with_duplicates_and_dry_run(c):
    csv_text = ("Customer Name,Mobile No,E-mail,Project,Remarks\n"
                "Anita Roy,98300 11111,anita@example.com,3BHK Goda,wants to visit sunday\n"
                "Anita Again,+91 9830011111,,3BHK Goda,duplicate inside file\n"
                "Existing Guy,9830012345,,2BHK,already in CRM\n"
                "No Contact,abc,,Plot,junk\n"
                "Mohan,9830022222,,Plot Borehat,\n")
    dry = c.post("/api/admin/leads/import", json={"source": "MagicBricks", "csv": csv_text, "dry_run": True}, headers=ADMIN).json()
    assert dry["created"] == 2 and dry["duplicates"] == 2 and dry["skipped"] == 1
    before = len(c.get("/api/admin/leads", headers=ADMIN).json())
    real = c.post("/api/admin/leads/import", json={"source": "MagicBricks", "csv": csv_text}, headers=ADMIN).json()
    assert real["created"] == 2 and real["columns"]["phone"] == "Mobile No"
    rows = c.get("/api/admin/leads", params={"source": "magicbricks"}, headers=ADMIN).json()
    assert len(rows) == 2 and all("imported" in r["tags"] for r in rows) and len(c.get("/api/admin/leads", headers=ADMIN).json()) == before + 2
    assert c.post("/api/admin/leads/import", json={"source": "x", "csv": "a,b\n1,2\n"}, headers=ADMIN).status_code == 422


def test_duplicates_merge_and_bulk(c):
    a = add(c, name="Dup One", phone="9830099991").json()
    b = add(c, name="Dup Two", phone="9830099991", force=True).json()
    c.post(f"/api/admin/leads/{b['id']}/notes", json={"text": "called twice"}, headers=ADMIN)
    groups = c.get("/api/admin/crm/duplicates", headers=ADMIN).json()
    assert any({x["id"] for x in g} >= {a["id"], b["id"]} for g in groups)
    m = c.post(f"/api/admin/leads/{b['id']}/merge", json={"into": a["id"]}, headers=ADMIN).json()
    assert m["id"] == a["id"] and any(n["text"] == "called twice" for n in m["notes"]) and any(x["type"] == "merge" for x in m["activities"])
    assert c.post(f"/api/admin/leads/{a['id']}/merge", json={"into": a["id"]}, headers=ADMIN).status_code == 422
    ids = [a["id"]]
    assert c.post("/api/admin/leads/bulk", json={"ids": ids, "action": "tag", "value": "vip"}, headers=ADMIN).json()["changed"] == 1
    assert c.post("/api/admin/leads/bulk", json={"ids": ids, "action": "status", "value": "site_visit"}, headers=ADMIN).json()["changed"] == 1
    assert c.post("/api/admin/leads/bulk", json={"ids": ids, "action": "priority", "value": "hot"}, headers=ADMIN).status_code == 200
    assert c.post("/api/admin/leads/bulk", json={"ids": ids, "action": "status", "value": "nope"}, headers=ADMIN).status_code == 422
    got = [l for l in c.get("/api/admin/leads", params={"tag": "vip"}, headers=ADMIN).json() if l["id"] == a["id"]][0]
    assert got["status"] == "site_visit" and got["temperature"] == "hot"


def test_summary_templates_and_export(c):
    late = add(c, name="Late One", phone="9830011112").json()
    c.patch(f"/api/admin/leads/{late['id']}", json={"next_follow_up": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()}, headers=ADMIN)
    s = c.get("/api/admin/crm/summary", headers=ADMIN).json()
    assert s["total"] >= 6 and s["new_today"] >= 1 and s["follow_ups_today"] + s["follow_ups_overdue"] >= 1
    assert {x["stage"] for x in s["stages"]} == set(server.LEAD_STAGES) and len(s["per_day"]) == 14
    assert any(x["source"] == "99acres" for x in s["sources"]) and s["closed_this_month"] >= 4200000
    t = c.get("/api/admin/crm/templates", headers=ADMIN).json()
    assert len(t["templates"]) >= 5 and "{name}" in t["templates"][0]["en"]
    saved = c.put("/api/admin/crm/templates", json={"templates": [{"label": "Mine", "en": "Hi {name}", "bn": ""}, {"label": "", "en": "dropped"}]}, headers=ADMIN).json()
    assert [x["label"] for x in saved["templates"]] == ["Mine"]
    csv_out = c.get("/api/admin/leads/export", headers=ADMIN)
    assert csv_out.status_code == 200 and csv_out.text.startswith("id,name,phone") and "temperature" in csv_out.text.splitlines()[0]


def test_ai_assistant_and_semantic_search_use_gemini(c, monkeypatch):
    lead = add(c, name="AI Lead", phone="9830044444").json()
    assert c.post(f"/api/admin/leads/{lead['id']}/ai", headers=ADMIN).status_code == 503        # no key configured
    monkeypatch.setattr(server, "GEMINI_API_KEY", "test-gemini-key")
    seen = {}

    async def fake(prompt):
        seen["prompt"] = prompt
        if "CRM search" in prompt:
            return {"ids": [lead["id"]]}
        return {"summary": "Interested in a 2BHK.", "next_action": "Call today", "urgency": "today", "whatsapp_en": "Hi!", "whatsapp_bn": "নমস্কার!"}

    monkeypatch.setattr(server, "gemini_json", fake)
    out = c.post(f"/api/admin/leads/{lead['id']}/ai", headers=ADMIN).json()
    assert out["next_action"] == "Call today" and out["whatsapp_bn"] and "AI Lead" in seen["prompt"] and "never quote a price" in seen["prompt"]
    sem = c.post("/api/admin/leads/semantic", json={"query": "someone who wants a 2bhk"}, headers=ADMIN).json()
    assert sem["reasoning"] == "AI-matched" and [m["id"] for m in sem["matches"]] == [lead["id"]]


def test_background_pass_alerts_once(c, monkeypatch):
    sent = []

    async def fake_notify(kind, title, body, link=None):
        sent.append((kind, title))

    monkeypatch.setattr(server, "notify_admin", fake_notify)
    lead = add(c, name="Due Now", phone="9830033333").json()
    old = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    c.portal.call(lambda: server.db.leads.update_one({"id": lead["id"]}, {"$set": {"next_follow_up": old, "created_at": old}}))
    c.portal.call(server.crm_pass)
    c.portal.call(server.crm_pass)                                                                # second pass must not repeat
    assert [t for k, t in sent if k == "followup"].count("Follow up: Due Now") == 1
    assert any(k == "lead_waiting" and "Due Now" in t for k, t in sent)
    assert sum(1 for k, t in sent if k == "lead_waiting" and "Due Now" in t) == 1
