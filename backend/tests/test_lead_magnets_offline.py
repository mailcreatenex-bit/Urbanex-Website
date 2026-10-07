"""Lead capture helpers: quick price, alerts, Vastu report, free checks, referrals, instant reply (no network).
    pytest backend/tests/test_lead_magnets_offline.py -n 0"""
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_magnets", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="", TURNSTILE_SECRET_KEY="",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-magnets-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import server  # noqa: E402
import crm_auto  # noqa: E402
import lead_magnets  # noqa: E402

ADMIN = {"Authorization": "Bearer lm-admin"}


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            await server.db.users.update_one({"email": "admin@example.com"}, {"$set": {"user_id": "lma", "name": "Ayan", "is_admin": True}}, upsert=True)
            await server.db.user_sessions.update_one({"session_token": "lm-admin"}, {"$set": {"user_id": "lma", "expires_at": exp}}, upsert=True)
            await server.db.properties.update_one({"id": "lm-prop"}, {"$set": {"id": "lm-prop", "slug": "lm-garden-3bhk", "title": "LM Garden 3BHK", "zone": "Goda", "property_type": "apartment", "bedrooms": 3,
                                                                              "price_inr": 5_500_000, "status": "available", "listing_type": "sale"}}, upsert=True)
        client.portal.call(seed)
        yield client


@pytest.fixture(autouse=True)
def fresh_limits():
    server._hits.clear()


def run(c, coro_fn, *a):
    return c.portal.call(coro_fn, *a)


def outbox_for(c, lid):
    async def go():
        return [m async for m in server.db.outbox.find({"lead_id": lid}, {"_id": 0})]
    return run(c, go)


def lead(c, lid):
    async def go():
        return await server.db.leads.find_one({"id": lid}, {"_id": 0})
    return run(c, go)


def test_quick_price_makes_a_hot_lead_and_a_reply_with_the_price(c):
    r = c.post("/api/enquiry/quick", json={"name": "Quick Buyer", "phone": "9831055001", "kind": "property", "ref_id": "lm-prop"})
    assert r.status_code == 200 and "wa.me" in r.json()["whatsapp"]
    lid = r.json()["id"]
    l = lead(c, lid)
    assert l["priority"] == "hot" and "wants-price" in l["tags"] and l["property_interest"] == "LM Garden 3BHK"
    m = [x for x in outbox_for(c, lid) if x["kind"] == "price_reply"]
    assert m and "55 lakh" in m[0]["text"] and "/book-visit/" in m[0]["text"] and m[0]["mode"] == "auto"
    assert c.post("/api/enquiry/quick", json={"name": "Bad", "phone": "123"}).status_code == 422


def test_quick_price_for_an_unknown_listing_still_captures(c):
    r = c.post("/api/enquiry/quick", json={"name": "Someone Else", "phone": "9831055002", "kind": "property", "ref_id": "nope"})
    assert r.status_code == 200 and lead(c, r.json()["id"])["priority"] == "hot"


def test_alert_signup_stores_what_they_want(c):
    r = c.post("/api/enquiry/alert", json={"name": "Alert Person", "phone": "9831055003", "source": "concierge", "zone": "Goda", "bedrooms": 3, "property_type": "apartment", "budget_inr": 6000000})
    assert r.status_code == 200
    l = lead(c, r.json()["id"])
    assert l["digest_opt_in"] is True and l["wants"]["bedrooms"] == 3 and "Goda" in l["wants"]["zones"] and "alert-signup" in l["tags"]
    assert any(m["kind"] == "instant_reply" and "3 BHK apartment in Goda" in m["text"] for m in outbox_for(c, l["id"]))


def test_vastu_report_scores_stores_and_marks_a_bad_plan_hot(c):
    body = {"name": "Vastu Fan", "phone": "9831055004", "facing": "S", "rooms": {"kitchen": ["NE"], "toilet": ["NE"], "pooja": ["SW"]}}
    r = c.post("/api/vastu/report", json=body)
    assert r.status_code == 200 and r.json()["score"] < 60
    got = c.get(f"/api/vastu/report/{r.json()['token']}").json()
    assert got["name"] == "Vastu" and got["result"]["must_fix"] and "phone" not in str(got)
    l = lead(c, [x for x in [lead_id(c, "9831055004")]][0])
    assert l["priority"] == "hot" and "vastu-low" in l["tags"]
    assert c.post("/api/vastu/report", json={**body, "rooms": {"jacuzzi": ["N"]}}).status_code == 422
    assert c.get("/api/vastu/report/nope").status_code == 404


def lead_id(c, phone):
    async def go():
        return (await server.db.leads.find_one({"phone_key": server.phone_key(server.clean_phone(phone))}, {"_id": 0, "id": 1}))["id"]
    return run(c, go)


def test_free_checks_run_out_and_a_waitlist_takes_over(c):
    run(c, lambda: server.db.free_checks.delete_many({}))
    assert c.put("/api/admin/free-checks/limit", json={"limit": 1}, headers=ADMIN).json()["limit"] == 1
    a = c.post("/api/free-checks", json={"name": "First Person", "phone": "9831055005", "kind": "plot_documents", "details": "Goda plot"}).json()
    b = c.post("/api/free-checks", json={"name": "Second Person", "phone": "9831055006", "kind": "land_report_preview"}).json()
    assert a["status"] == "booked" and b["status"] == "waitlist" and b["left"] == 0
    st = c.get("/api/free-checks/status").json()
    assert st["used"] == 1 and st["left"] == 0 and len(st["types"]) == 2
    adm = c.get("/api/admin/free-checks", headers=ADMIN).json()
    assert len(adm["items"]) == 2
    assert c.patch(f"/api/admin/free-checks/{adm['items'][0]['id']}", json={"status": "done"}, headers=ADMIN).status_code == 200
    assert c.get("/api/admin/free-checks").status_code in (401, 403)
    c.put("/api/admin/free-checks/limit", json={"limit": 10}, headers=ADMIN)


def test_referral_link_tags_the_new_lead_and_counts(c):
    ref = c.post("/api/admin/referrals", json={"name": "Old Client", "phone": "9831055007"}, headers=ADMIN).json()
    code = ref["code"]
    assert ref["link"].endswith(f"/r/{code}") and c.get(f"/api/r/{code}").json()["name"] == "Old"
    assert c.get("/api/r/zzzz9999").status_code == 404
    r = c.post("/api/leads", json={"name": "Friend Of Client", "phone": "9831055008", "source_page": "contact"}, headers={"X-Referral": code})
    assert r.status_code == 200
    l = lead(c, r.json()["id"])
    assert l["referred_by"] == code and f"ref-{code}" in l["tags"]
    row = [x for x in c.get("/api/admin/referrals", headers=ADMIN).json() if x["code"] == code][0]
    assert row["leads"] == 1 and row["clicks"] == 1
    assert c.patch(f"/api/admin/referrals/{code}", json={"rewarded": True, "reward_note": "Sweets"}, headers=ADMIN).status_code == 200
    # a made-up code does nothing
    r2 = c.post("/api/leads", json={"name": "No Referral", "phone": "9831055009", "source_page": "contact"}, headers={"X-Referral": "fake1234"})
    assert not lead(c, r2.json()["id"]).get("referred_by")


def test_instant_reply_only_at_night_by_default(c, monkeypatch):
    async def noon(*a):
        return None
    run(c, lambda: server.db.settings.delete_one({"_id": "crm_instant"}))
    monkeypatch.setattr(crm_auto, "in_quiet_hours", lambda cfg, now=None: False)
    r = c.post("/api/leads", json={"name": "Day Enquiry", "phone": "9831055010", "source_page": "contact", "property_interest": "LM Garden 3BHK"})
    run(c, lead_magnets.instant_hook, r.json()["id"], True)
    assert not [m for m in outbox_for(c, r.json()["id"]) if m["kind"] == "instant_reply"]
    monkeypatch.setattr(crm_auto, "in_quiet_hours", lambda cfg, now=None: True)
    r = c.post("/api/leads", json={"name": "Night Enquiry", "phone": "9831055011", "source_page": "contact", "property_interest": "LM Garden 3BHK"})
    run(c, lead_magnets.instant_hook, r.json()["id"], True)
    m = [m for m in outbox_for(c, r.json()["id"]) if m["kind"] == "instant_reply"]
    assert m and "morning" in m[0]["text"] and "/properties/lm-garden-3bhk" in m[0]["text"] and "/book-visit/" in m[0]["text"]
    # "always" also answers in the daytime
    monkeypatch.setattr(crm_auto, "in_quiet_hours", lambda cfg, now=None: False)
    assert c.put("/api/admin/crm/instant", json={"scope": "always"}, headers=ADMIN).json()["scope"] == "always"
    r = c.post("/api/leads", json={"name": "Always Enquiry", "phone": "9831055012", "source_page": "contact"})
    run(c, lead_magnets.instant_hook, r.json()["id"], True)
    m = [m for m in outbox_for(c, r.json()["id"]) if m["kind"] == "instant_reply"]
    assert m and "shortly" in m[0]["text"]
    c.put("/api/admin/crm/instant", json={"scope": "night"}, headers=ADMIN)


def test_night_delivery_only_lets_replies_through(c, monkeypatch):
    sent = []

    async def fake_send(phone, text):
        sent.append(text)
        return "wamid.x"
    monkeypatch.setattr(crm_auto, "send_whatsapp_api", fake_send)
    monkeypatch.setattr(crm_auto, "WHATSAPP_TOKEN", "t")
    monkeypatch.setattr(crm_auto, "WHATSAPP_PHONE_ID", "1")
    monkeypatch.setattr(crm_auto, "in_quiet_hours", lambda cfg, now=None: True)
    run(c, lambda: server.db.outbox.delete_many({}))
    lid = lead_id(c, "9831055001")

    async def seed():
        base = {"lead_id": lid, "channel": "whatsapp", "lang": "en", "status": "queued", "mode": "auto", "created_at": server.now_utc().isoformat()}
        await server.db.outbox.insert_one({**base, "id": "ob_a", "kind": "price_reply", "text": "reply goes"})
        await server.db.outbox.insert_one({**base, "id": "ob_b", "kind": "revival", "text": "marketing waits"})
    run(c, seed)
    run(c, crm_auto.deliver_pass)
    assert sent == ["reply goes"]
