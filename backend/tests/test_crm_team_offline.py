"""CRM team mode: who may see what, automatic assignment, moving unanswered leads, team stats.
    pytest backend/tests/test_crm_team_offline.py -n 0"""
import asyncio
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_team", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="", TURNSTILE_SECRET_KEY="",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-team-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import server  # noqa: E402
import crm_staff  # noqa: E402
import _iso  # noqa: E402

ADMIN = {"Authorization": "Bearer te-admin"}
RIYA = {"Authorization": "Bearer te-riya"}
SAM = {"Authorization": "Bearer te-sam"}
OUT = {"Authorization": "Bearer te-out"}


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            for uid, email, name, tok, admin in (("tea", "admin@example.com", "Ayan", "te-admin", True), ("ter", "riya@example.com", "Riya", "te-riya", False),
                                                 ("tes", "sam@example.com", "Sam", "te-sam", False), ("teo", "outsider@example.com", "Outsider", "te-out", False)):
                await server.db.users.update_one({"email": email}, {"$set": {"user_id": uid, "name": name, "is_admin": admin}}, upsert=True)
                await server.db.user_sessions.update_one({"session_token": tok}, {"$set": {"user_id": uid, "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        before = client.portal.call(_iso.snapshot, server)
        yield client
        client.portal.call(_iso.restore, server, before)
        client.portal.call(lambda: server.db.staff.delete_many({}))
        client.portal.call(lambda: server.db.settings.delete_many({"_id": {"$in": ["crm_team"]}}))


def ingest(c, **kw):
    kw.setdefault("source", "website")
    return c.portal.call(lambda: server.ingest_lead(**kw))


def settle(c, secs=0.4):
    c.portal.call(asyncio.sleep, secs)


def test_only_admin_manages_the_team_and_me_reports_staff(c):
    assert c.get("/api/admin/crm/team", headers=RIYA).status_code == 403
    assert c.post("/api/admin/crm/team", json={"email": "riya@example.com", "name": "Riya"}, headers=RIYA).status_code == 403
    for email, name in (("riya@example.com", "Riya"), ("sam@example.com", "Sam")):
        assert c.post("/api/admin/crm/team", json={"email": email.upper(), "name": name, "capacity": 5}, headers=ADMIN).status_code == 200
    assert c.post("/api/admin/crm/team", json={"email": "not an email", "name": "x"}, headers=ADMIN).status_code == 422
    assert c.get("/api/auth/me", headers=RIYA).json()["is_staff"] is True and c.get("/api/auth/me", headers=ADMIN).json()["is_staff"] is False and c.get("/api/auth/me", headers=OUT).json()["is_staff"] is False


def test_new_leads_are_shared_out_fairly(c):
    ids = [ingest(c, name=f"Fair Fatima {i}", phone=f"983110000{i}", message="please call")["id"] for i in range(4)]
    settle(c)
    owners = [c.portal.call(lambda i=i: server.db.leads.find_one({"id": i}))["owner_email"] for i in ids]
    assert sorted(set(owners)) == ["riya@example.com", "sam@example.com"] and owners.count("riya@example.com") == 2        # two each
    assert any(a["type"] == "assigned" for a in c.portal.call(lambda: server.db.leads.find_one({"id": ids[0]}))["activities"])
    spam = ingest(c, name="asdfgh", phone="9999999999", message="x y z")
    settle(c)
    assert c.portal.call(lambda: server.db.leads.find_one({"id": spam["id"]}))["owner_email"] is None                       # spam is not given to anyone


def test_a_team_member_sees_and_changes_only_their_own_leads(c):
    mine = [l for l in c.get("/api/admin/leads", headers=RIYA).json()]
    assert len(mine) == 2 and all(l["owner_email"] == "riya@example.com" for l in mine)
    assert len(c.get("/api/admin/leads", headers=ADMIN).json()) >= 4
    assert {l["owner_email"] for l in c.get("/api/admin/leads", headers=SAM).json()} == {"sam@example.com"}
    sam_lead = c.get("/api/admin/leads", headers=SAM).json()[0]["id"]
    my = mine[0]["id"]
    assert c.patch(f"/api/admin/leads/{my}", json={"status": "contacted"}, headers=RIYA).status_code == 200
    assert c.patch(f"/api/admin/leads/{sam_lead}", json={"status": "contacted"}, headers=RIYA).status_code == 403             # someone else's lead
    assert c.post(f"/api/admin/leads/{my}/notes", json={"text": "spoke to him"}, headers=RIYA).status_code == 200
    assert c.post(f"/api/admin/leads/{sam_lead}/activity", json={"type": "call"}, headers=RIYA).status_code == 403
    assert c.get(f"/api/admin/leads/{my}/brief", headers=RIYA).status_code == 200
    assert c.get("/api/admin/crm/plan", headers=RIYA).status_code == 200 and all(i["id"] != sam_lead for i in c.get("/api/admin/crm/plan", headers=RIYA).json()["items"])
    assert c.get("/api/admin/crm/summary", headers=RIYA).json()["total"] == 2
    # never anything outside the CRM lead screens
    for path in ("/api/admin/listings", "/api/admin/properties", "/api/admin/crm/outbox", "/api/admin/crm/team", "/api/admin/leads/export", "/api/admin/crm/inbox"):
        assert c.get(path, headers=RIYA).status_code in (403, 404), path
    assert c.post("/api/admin/leads/bulk", json={"ids": [my], "action": "tag", "value": "x"}, headers=RIYA).status_code == 403
    assert c.get("/api/admin/leads", headers=OUT).status_code == 403                                                          # signed in but not on the team
    mine_new = c.post("/api/admin/leads", json={"name": "Riya's Own", "phone": "9831100099", "source_page": "walk_in"}, headers=RIYA)
    assert mine_new.status_code == 200 and c.portal.call(lambda: server.db.leads.find_one({"id": mine_new.json()["id"]}))["owner_email"] == "riya@example.com"


def test_unanswered_leads_move_on_and_a_removed_member_hands_over(c):
    settle(c)
    stuck = ingest(c, name="Stuck Sanjay", phone="9831100050", message="call me")
    settle(c)
    first = c.portal.call(lambda: server.db.leads.find_one({"id": stuck["id"]}))["owner_email"]
    old = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    c.portal.call(lambda: server.db.leads.update_one({"id": stuck["id"]}, {"$set": {"created_at": old}}))
    assert c.portal.call(crm_staff.rebalance_pass) >= 1
    after = c.portal.call(lambda: server.db.leads.find_one({"id": stuck["id"]}))
    assert after["owner_email"] and after["owner_email"] != first and after.get("reassigned_at")
    assert c.portal.call(crm_staff.rebalance_pass) == 0                                                                        # moved once, not forever
    r = c.delete("/api/admin/crm/team/sam@example.com", headers=ADMIN)
    assert r.status_code == 200
    owners = {l["owner_email"] for l in c.portal.call(lambda: server.db.leads.find({"status": {"$nin": ["closed", "lost"]}, "spam": {"$ne": True}, "owner_email": {"$ne": None}}).to_list(100))}
    assert "sam@example.com" not in owners
    assert c.get("/api/admin/leads", headers=SAM).status_code == 403                                                           # no longer on the team


def test_team_screen_numbers_and_settings(c):
    c.post("/api/admin/crm/team", json={"email": "sam@example.com", "name": "Sam", "capacity": 1}, headers=ADMIN)
    team = c.get("/api/admin/crm/team", headers=ADMIN).json()
    riya = [m for m in team["members"] if m["email"] == "riya@example.com"][0]
    assert riya["open"] >= 2 and "untouched" in riya and team["settings"]["auto_assign"] is True
    assert c.put("/api/admin/crm/team/settings", json={"auto_assign": False}, headers=ADMIN).json()["auto_assign"] is False
    free = ingest(c, name="Free Farhan", phone="9831100060", message="hello there")
    settle(c)
    assert c.portal.call(lambda: server.db.leads.find_one({"id": free["id"]}))["owner_email"] is None                       # automatic hand-out is switched off
    ass = c.post("/api/admin/leads/bulk-assign", json={"ids": [free["id"]], "owner_email": "sam@example.com"}, headers=ADMIN)
    assert ass.json()["changed"] == 1 and c.portal.call(lambda: server.db.leads.find_one({"id": free["id"]}))["owner_email"] == "sam@example.com"
    assert c.post("/api/admin/leads/bulk-assign", json={"ids": [free["id"]], "owner_email": "ghost@example.com"}, headers=ADMIN).status_code == 404
    c.put("/api/admin/crm/team/settings", json={"auto_assign": True}, headers=ADMIN)
