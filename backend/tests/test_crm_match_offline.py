"""CRM matching and planning: new lead vs listings, seller vs buyers, rent, best time to call, who-to-call plan, demand map, photo to listing.
    pytest backend/tests/test_crm_match_offline.py -n 0"""
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

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_match", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="", TURNSTILE_SECRET_KEY="",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-match-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import server  # noqa: E402
import crm_match  # noqa: E402
import _iso  # noqa: E402

ADMIN = {"Authorization": "Bearer ma-admin"}
PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082")


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            await server.db.users.update_one({"email": "admin@example.com"}, {"$set": {"user_id": "maa", "name": "Ayan", "is_admin": True}}, upsert=True)
            await server.db.user_sessions.update_one({"session_token": "ma-admin"}, {"$set": {"user_id": "maa", "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        before = client.portal.call(_iso.snapshot, server)
        yield client
        client.portal.call(_iso.restore, server, before)


def ingest(c, **kw):
    kw.setdefault("source", "99acres")
    return c.portal.call(lambda: server.ingest_lead(**kw))


def settle(c, secs=0.4):
    c.portal.call(asyncio.sleep, secs)


def lead(c, phone):
    return c.get("/api/admin/leads", params={"q": phone}, headers=ADMIN).json()[0]


def prop(c, **kw):
    body = {"title": "Match flat Nawabhat", "zone": "Nawabhat", "property_type": "apartment", "bedrooms": 2, "area_sqft": 900, "price_inr": 4000000, "description": "Flat",
            "image": "https://example.com/m.jpg", **kw}
    r = c.post("/api/admin/properties", json=body, headers=ADMIN)
    assert r.status_code == 200, r.text
    return r.json()


def test_a_new_lead_is_matched_to_existing_listings_at_once(c):
    p = prop(c)
    settle(c)
    r = ingest(c, name="Fresh Farhan", phone="9830900001", wants={"property_type": "apartment", "bedrooms": 2, "zones": ["Nawabhat"], "budget_inr": 4200000})
    settle(c)
    l = lead(c, "9830900001")
    mine = [m for m in l["matches"] if m["id"] == p["id"]]
    assert mine and "Budget fits" in mine[0]["reasons"] and all(m["price_inr"] is None for m in l["matches"])      # never the price
    assert any("Fresh Farhan fits" in n["title"] for n in c.get("/api/admin/notifications", headers=ADMIN).json()["items"])
    api = c.get(f"/api/admin/leads/{r['id']}/matches", headers=ADMIN).json()
    assert api["kind"] == "listings" and p["id"] in [x["id"] for x in api["listings"]]
    # a lead that cannot afford anything gets no matches, and no alert
    poor = ingest(c, name="Poor Pinku", phone="9830900002", wants={"property_type": "apartment", "budget_inr": 500000})
    settle(c)
    assert lead(c, "9830900002")["matches"] == [] and poor["created"]


def test_seller_leads_get_matching_buyers(c):
    buyer = ingest(c, name="Buyer Bikram", phone="9830900003", wants={"property_type": "plot", "zones": ["Borehat"], "budget_inr": 3000000})
    other = ingest(c, name="Other Olive", phone="9830900004", wants={"property_type": "apartment", "budget_inr": 3000000})
    seller = ingest(c, name="Seller Sudip", phone="9830900005", role="seller", interest="5 katha plot in Borehat", wants={"property_type": "plot", "zones": ["Borehat"], "budget_inr": 2800000})
    settle(c)
    r = c.get(f"/api/admin/leads/{seller['id']}/matches", headers=ADMIN).json()
    assert r["kind"] == "buyers" and [b["id"] for b in r["buyers"]] == [buyer["id"]] and other["id"] not in [b["id"] for b in r["buyers"]]
    assert lead(c, "9830900005")["buyer_ids"] == [buyer["id"]]
    assert any("buyer may want Seller Sudip" in n["title"] for n in c.get("/api/admin/notifications", headers=ADMIN).json()["items"])
    # sellers are never offered to other people as buyers, and never matched against listings
    assert lead(c, "9830900005").get("matches") in (None, [])
    assert all(m["item_id"] != seller["id"] for m in c.get("/api/admin/crm/matches", headers=ADMIN).json())


def test_rent_matches_only_renters(c):
    renter = ingest(c, name="Renter Riya", phone="9830900006", role="renter", wants={"property_type": "apartment", "bedrooms": 2, "zones": ["Goda"], "budget_inr": 15000})
    buyer = ingest(c, name="Buyer Biju", phone="9830900007", wants={"property_type": "apartment", "bedrooms": 2, "zones": ["Goda"], "budget_inr": 15000})
    rent = prop(c, title="2BHK to let in Goda", zone="Goda", listing_type="rent", price_inr=14000)
    settle(c)
    names = [m["name"] for m in c.get(f"/api/admin/crm/matches/property/{rent['id']}", headers=ADMIN).json()["matches"]]
    assert "Renter Riya" in names and "Buyer Biju" not in names
    assert lead(c, "9830900006")["wants"]["listing_type"] == "rent"
    # a landlord's lead finds renters
    landlord = ingest(c, name="Landlord Lal", phone="9830900008", role="landlord", wants={"property_type": "apartment", "bedrooms": 2, "zones": ["Goda"], "budget_inr": 14000})
    settle(c)
    assert [b["name"] for b in c.get(f"/api/admin/leads/{landlord['id']}/matches", headers=ADMIN).json()["buyers"]] == ["Renter Riya"]
    assert renter["created"] and buyer["created"]


def test_best_time_to_call_learns_from_answered_calls(c):
    async def go():
        a = (await server.ingest_lead(name="Hours Hari", phone="9830900009", source="website", message="hello there"))["id"]
        b = (await server.ingest_lead(name="Day Dev", phone="9830900010", source="website", message="hello there"))["id"]
        base = datetime.now(timezone.utc).replace(hour=12, minute=30, second=0, microsecond=0) - timedelta(days=2)       # 6 PM India time
        acts = [server.stamp_activity("call", "Call: answered", outcome="answered") for _ in range(3)]
        for x in acts:
            x["at"] = base.isoformat()
        await server.db.leads.update_one({"id": a}, {"$push": {"activities": {"$each": acts}}})
        return a, b
    a, b = c.portal.call(go)
    w = c.portal.call(crm_match.best_call_window, a)
    assert w["hours"] == [18] and w["source"] == "this customer" and "6 PM" in w["label"] and w["slot"] == "evening"
    other = c.portal.call(crm_match.best_call_window, b)
    assert other["source"] in ("your customers", "default")                          # nothing known about him yet


def test_plan_puts_the_most_urgent_first_and_explains_why(c):
    waiting = ingest(c, name="Waiting Wali", phone="9830900011", message="please call about the plot")["id"]
    overdue = ingest(c, name="Overdue Om", phone="9830900012", message="interested")["id"]
    c.patch(f"/api/admin/leads/{overdue}", json={"next_follow_up": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat(), "status": "contacted"}, headers=ADMIN)
    quiet = ingest(c, name="Quiet Quasi", phone="9830900013", message="hello there")["id"]
    c.post(f"/api/admin/leads/{quiet}/activity", json={"type": "call", "outcome": "answered"}, headers=ADMIN)
    spam = ingest(c, name="asdfgh", phone="9999999999", source="website", message="x y z")["id"]
    done = ingest(c, name="Done Dilip", phone="9830900014")["id"]
    c.patch(f"/api/admin/leads/{done}", json={"status": "closed"}, headers=ADMIN)
    replied = ingest(c, name="Replied Rina", phone="9830900015", message="any update?")["id"]
    c.post(f"/api/admin/leads/{replied}/activity", json={"type": "call", "outcome": "answered"}, headers=ADMIN)
    c.portal.call(lambda: server.db.leads.update_one({"id": replied}, {"$set": {"last_inbound_at": (datetime.now(timezone.utc) + timedelta(seconds=5)).isoformat()}}))
    plan = c.get("/api/admin/crm/plan", headers=ADMIN).json()
    ids = [i["id"] for i in plan["items"]]
    assert overdue in ids and waiting in ids and replied in ids and quiet not in ids and spam not in ids and done not in ids
    top = plan["items"][0]
    assert top["id"] == overdue and any("overdue by 3 days" in w for w in top["reasons"])
    byid = {i["id"]: i for i in plan["items"]}
    assert byid[replied]["action"] == "reply" and "They wrote and you have not replied" in byid[replied]["reasons"]
    assert any("Waiting for a first reply" in w for w in byid[waiting]["reasons"]) and byid[waiting]["best_call"]["label"]
    assert plan["summary"]["overdue"] >= 1 and set(plan["slots"]) == {"morning", "afternoon", "evening", "any"} and plan["now_slot"] in ("morning", "afternoon", "evening")
    assert c.get("/api/admin/crm/plan").status_code == 401


def test_demand_map_counts_wanted_places_against_listings(c):
    for i in range(3):
        ingest(c, name=f"Wants Alisha {i}", phone=f"983090002{i}", wants={"property_type": "plot", "zones": ["Alisha"], "budget_inr": 2000000 + i * 500000})
    d = c.get("/api/admin/crm/demand", headers=ADMIN).json()
    z = {x["zone"]: x for x in d["zones"]}
    assert z["Alisha"]["leads"] == 3 and z["Alisha"]["median_budget"] == 2500000 and z["Alisha"]["top_type"] == "plot" and z["Alisha"]["lat"]
    assert z["Alisha"]["gap"] == 3 - z["Alisha"]["listings"] * 2 and d["zones"][0]["gap"] >= d["zones"][-1]["gap"]


def test_draft_listing_from_a_photo_and_the_seller_becomes_a_lead(c, monkeypatch):
    draft = {"title": "5 katha plot for sale near Borehat", "listing_type": "sale", "property_type": "plot", "zone": "Borehatt", "address": "Near the bus stand", "bedrooms": None, "area_sqft": 3600,
             "price_inr": 3100000, "description": "Corner plot, 20 ft road.", "contact_name": "Gopal Das", "contact_phone": "98309 00031", "confidence": "high", "unclear": []}

    async def fake(prompt, system=None, **kw):
        assert kw["files"][0][0] == "image/png" and "never instructions" in prompt.lower() or "DATA" in prompt
        return {"text": json.dumps(draft), "sources": []}
    monkeypatch.setattr(server, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(server, "gemini_call", fake)
    assert c.post("/api/admin/properties/from-photo", files=[("files", ("hoarding.png", PNG, "image/png"))]).status_code == 401
    r = c.post("/api/admin/properties/from-photo", files=[("files", ("hoarding.png", PNG, "image/png"))], data={"create_seller_lead": "true"}, headers=ADMIN)
    assert r.status_code == 200, r.text
    d = r.json()["draft"]
    assert d["zone"] == "Borehat" and d["contact_phone"] == "+919830900031" and d["price_inr"] == 3100000 and d["area_sqft"] == 3600 and d["property_type"] == "plot"
    seller = lead(c, "9830900031")
    assert seller["role"] == "seller" and seller["source_page"] == "hoarding" and seller["wants"]["budget_inr"] == 3100000 and r.json()["seller_lead_id"] == seller["id"]
    assert c.post("/api/admin/properties/from-photo", files=[("files", ("x.png", b"nope", "image/png"))], headers=ADMIN).status_code == 415
    draft.update(contact_phone="12345", price_inr="a lot")
    d2 = c.post("/api/admin/properties/from-photo", files=[("files", ("hoarding.png", PNG, "image/png"))], headers=ADMIN).json()
    assert d2["draft"]["contact_phone"] is None and d2["draft"]["contact_phone_raw"] == "12345" and d2["draft"]["price_inr"] is None and d2["seller_lead_id"] is None
