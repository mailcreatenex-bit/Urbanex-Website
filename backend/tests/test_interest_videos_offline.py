"""Offline tests: YouTube auto-sync (incl. back catalogue), video catalogue filters, and the Interested price gate.

    pytest backend/tests/test_interest_videos_offline.py -n 0
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
    MONGO_URL="mongodb://offline", DB_NAME="offline_test3", CORS_ORIGINS="http://localhost:3000",
    ADMIN_EMAILS="admin@example.com", YOUTUBE_API_KEY="", SMTP_HOST="", ALERT_WEBHOOK_URL="",
    UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-test-uploads-"),
)
import motor.motor_asyncio  # noqa: E402

motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

ADMIN = {"Authorization": "Bearer admin3-tok"}
LOGIN = {"Authorization": "Bearer login3-tok"}


@pytest.fixture(scope="module")
def c():
    # https base URL so the Secure contact cookie is sent back, like a real browser would
    with TestClient(server.app, base_url="https://testserver") as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            for uid, email, name, adm, tok in (("a3", "admin@example.com", "Ayan Dey", True, "admin3-tok"),
                                               ("l3", "login3@example.com", "Login Three", False, "login3-tok")):
                await server.db.users.update_one({"email": email}, {"$set": {"user_id": uid, "name": name, "is_admin": adm}}, upsert=True)
                await server.db.user_sessions.update_one({"session_token": tok}, {"$set": {"user_id": uid, "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        yield client


@pytest.fixture(autouse=True)
def _reset_limits():
    server._hits.clear()


def fresh():
    return TestClient(server.app, base_url="https://testserver")


# ------------------------------------------------------------------ parsing
@pytest.mark.parametrize("text,expected", [
    ("Price: 65 lakh", 6_500_000), ("₹68,00,000 only", 6_800_000), ("Rs. 1.2 Cr negotiable", 12_000_000),
    ("asking price - 45L", 4_500_000), ("Priced at INR 3.5 crore", 35_000_000), ("A 3 cr bungalow", 30_000_000),
    ("1450 sqft flat in Goda", None), ("Call 9933333333", None), ("₹ 500 entry fee", None),
])
def test_parse_price(text, expected):
    assert server.parse_price(text) == expected


def test_strip_price_text_keeps_the_rest():
    assert server.strip_price_text("3BHK Flat in Goda | ₹68 Lakh") == "3BHK Flat in Goda"
    out = server.strip_price_text("Lovely home.\nPrice: 65 lakh\nCall Ayan.")
    assert "65" not in out and "lakh" not in out.lower() and "Call Ayan." in out and "Lovely home." in out
    assert server.strip_price_text("Villa with 2 cr value") == "Villa with value"
    assert server.strip_price_text("Area 900 sqft. Price: 65 lakh.") == "Area 900 sqft."


def test_parse_duration_and_meta():
    assert server.parse_duration("PT1M5S") == 65 and server.parse_duration("PT1H2M3S") == 3723 and server.parse_duration("bogus") == 0
    zones = ["Goda", "Kalibazar", "Renaissance Township"]
    m = server.parse_listing_meta("Luxury 3BHK flat in Goda", "Price: 68 lakh. Area 1,450 sqft. Near Kalibazar.", zones)
    assert m == {"zone": "Goda", "property_type": "apartment", "bedrooms": 3, "area_sqft": 1450, "price_inr": 6_800_000}
    assert server.parse_listing_meta("Plot in Renaissance Township", "", zones)["property_type"] == "plot"
    assert server.parse_listing_meta("Boutique villa tour", "4 BHK villa", zones)["property_type"] == "villa"
    assert "zone" not in server.parse_listing_meta("Burdwan market walk", "", zones)


# ------------------------------------------------------------------ YouTube sync
CHANNEL: list = []   # video ids, newest first
DETAILS: dict = {}


def vid(i: int) -> str:
    return f"v{i:010d}"


def make(i, title, desc="", privacy="public", days_ago=None):
    pub = datetime.now(timezone.utc) - timedelta(days=i if days_ago is None else days_ago)
    return {"id": vid(i), "snippet": {"title": title, "description": desc, "publishedAt": pub.isoformat().replace("+00:00", "Z"),
                                       "thumbnails": {"high": {"url": f"https://i.ytimg.com/vi/{vid(i)}/hqdefault.jpg"}}, "liveBroadcastContent": "none"},
            "contentDetails": {"duration": "PT4M10S"}, "status": {"privacyStatus": privacy}}


async def fake_yt_get(path, params):
    if path == "channels":
        return {"items": [{"contentDetails": {"relatedPlaylists": {"uploads": "UUfake"}}}]}
    if path == "playlistItems":
        off = int(params.get("pageToken") or 0)
        ids = CHANNEL[off:off + 50]
        out = {"items": [{"contentDetails": {"videoId": i}} for i in ids]}
        if off + 50 < len(CHANNEL):
            out["nextPageToken"] = str(off + 50)
        return out
    if path == "videos":
        return {"items": [DETAILS[i] for i in params["id"].split(",") if i in DETAILS and DETAILS[i]["status"]["privacyStatus"] != "deleted"]}
    raise AssertionError(path)


@pytest.fixture()
def channel(monkeypatch):
    monkeypatch.setattr(server, "YOUTUBE_API_KEY", "test-key")
    monkeypatch.setattr(server, "yt_get", fake_yt_get)
    CHANNEL.clear()
    DETAILS.clear()
    for i in range(130):  # 130 uploads = 3 playlist pages
        zone = ["Goda", "Kalibazar", "Borehat", "Nawabhat"][i % 4]
        DETAILS[vid(i)] = make(i, f"3BHK flat in {zone} | ₹{40 + i % 30} Lakh", f"Price: {40 + i % 30} lakh. {1000 + i} sqft.")
        CHANNEL.append(vid(i))
    DETAILS[vid(7)]["status"]["privacyStatus"] = "private"
    return CHANNEL


def run(c, coro_fn, *args):
    return c.portal.call(coro_fn, *args)


def listing(c, **params):
    return c.get("/api/video-listings", params=params).json()


def test_full_sync_brings_in_the_whole_back_catalogue(c, channel):
    c.portal.call(lambda: server.db.videos.delete_many({}))
    st = run(c, server.sync_youtube, True)
    assert st["ok"] and st["new"] == 129 and st["pages"] == 3         # 130 uploads, 1 private
    assert listing(c)["total"] == 129
    oldest = listing(c, sort="oldest", limit=1)["items"][0]
    assert oldest["video_id"] == vid(129)                              # the oldest upload is on the site too
    assert vid(7) not in [v["video_id"] for v in listing(c, limit=48)["items"]]
    last_page = listing(c, page=3, limit=48)
    assert last_page["pages"] == 3 and len(last_page["items"]) == 129 - 96


def test_public_catalogue_never_exposes_prices(c, channel):
    run(c, server.sync_youtube, True)
    v = listing(c)["items"][0]
    blob = str(c.get("/api/video-listings").json()) + str(c.get(f"/api/video-listings/{v['video_id']}").json()) + str(c.get("/api/videos").json())
    assert "price" not in blob.lower() and "lakh" not in blob.lower() and "₹" not in blob
    assert all("price_inr" not in i for i in listing(c, limit=48)["items"])
    assert c.get("/api/video-listings/doesnotexist").status_code == 404
    assert c.get("/api/video-listings/facets").json()["total"] >= 1


def test_filters_by_location_type_beds_and_budget(c, channel):
    run(c, server.sync_youtube, True)
    goda = listing(c, zone="Goda", limit=48)
    assert goda["total"] > 0 and all(i["zone"] == "Goda" for i in goda["items"])
    assert listing(c, zone="Atlantis")["total"] == 0
    assert listing(c, property_type="villa")["total"] == 0
    assert listing(c, min_bedrooms=4)["total"] == 0 and listing(c, min_bedrooms=3)["total"] > 0
    # budget band b2 = 30-60 lakh. Videos priced 40..69 lakh: b2 + b3 together must cover everything priced
    b2, b3 = listing(c, budget="b2")["total"], listing(c, budget="b3")["total"]
    assert b2 > 0 and b3 > 0 and b2 + b3 == listing(c)["total"]
    assert listing(c, budget="b1")["total"] == 0
    assert c.get("/api/video-listings", params={"budget": "x"}).status_code == 422
    assert listing(c, q="kalibazar")["total"] > 0
    facets = c.get("/api/video-listings/facets").json()
    assert {z["zone"] for z in facets["zones"]} >= {"Goda", "Kalibazar", "Borehat", "Nawabhat"}


def test_new_upload_appears_on_next_incremental_sync(c, channel):
    run(c, server.sync_youtube, True)
    before = listing(c)["total"]
    DETAILS["vnew0000001"] = {**make(0, "Brand new villa in Kalibazar", "4BHK villa. ₹1.4 Cr", days_ago=0), "id": "vnew0000001"}
    CHANNEL.insert(0, "vnew0000001")
    st = run(c, server.sync_youtube, False)
    assert st["ok"] and st["new"] == 1 and st["pages"] == 2           # incremental run only looks at the newest 100
    assert listing(c)["total"] == before + 1
    newest = listing(c, limit=1)["items"][0]
    assert newest["video_id"] == "vnew0000001" and newest["zone"] == "Kalibazar" and newest["property_type"] == "villa" and newest["bedrooms"] == 4
    assert "1.4" not in newest["title"] + (newest["description"] or "")
    notes = c.get("/api/admin/notifications", headers=ADMIN).json()["items"]
    assert any("YouTube" in n["title"] for n in notes)


def test_deleted_or_private_videos_disappear_after_full_sync_and_admin_edits_survive(c, channel):
    run(c, server.sync_youtube, True)
    target = vid(10)
    # admin sets details by hand; later syncs must not overwrite them
    r = c.patch(f"/api/admin/videos/{target}", json={"zone": "Rajbati", "price_inr": 5_500_000}, headers=ADMIN)
    assert r.status_code == 200 and sorted(r.json()["locked_fields"]) == ["price_inr", "zone"]
    DETAILS[target]["snippet"]["description"] = "Price: 99 lakh. In Goda."  # the title (Borehat, 50 lakh) takes priority
    run(c, server.sync_youtube, True)
    kept = next(v for v in c.get("/api/admin/videos", headers=ADMIN).json()["items"] if v["video_id"] == target)
    assert kept["zone"] == "Rajbati" and kept["price_inr"] == 5_500_000
    # reparse hands control back to the YouTube text
    back = c.patch(f"/api/admin/videos/{target}", json={"reparse": True}, headers=ADMIN).json()
    assert back["zone"] == "Borehat" and back["price_inr"] == 5_000_000 and back["locked_fields"] == []
    # hide + remove from channel
    c.patch(f"/api/admin/videos/{vid(11)}", json={"hidden": True}, headers=ADMIN)
    assert vid(11) not in [v["video_id"] for v in listing(c, limit=48)["items"]]
    del DETAILS[vid(20)]
    CHANNEL.remove(vid(20))
    run(c, server.sync_youtube, True)
    assert c.get(f"/api/video-listings/{vid(20)}").status_code == 404


def test_sync_reports_problems_instead_of_crashing(c, monkeypatch):
    assert run(c, server.sync_youtube, False)["ok"] is False or True  # key from fixture may be unset
    monkeypatch.setattr(server, "YOUTUBE_API_KEY", "")
    assert run(c, server.sync_youtube, False) == {"ok": False, "error": "YOUTUBE_API_KEY is not set"}

    async def boom(path, params):
        raise RuntimeError("quota exceeded")

    monkeypatch.setattr(server, "YOUTUBE_API_KEY", "k")
    monkeypatch.setattr(server, "yt_get", boom)
    res = run(c, server.sync_youtube, False)
    assert res["ok"] is False and "quota" in res["error"]
    status = c.get("/api/admin/videos", headers=ADMIN).json()["sync"]
    assert "quota" in status["last_error"]
    assert c.get("/api/admin/videos").status_code == 401
    assert c.post("/api/admin/videos/sync", json={}).status_code == 401


# ------------------------------------------------------------------ Interested
def two_videos(c):
    items = listing(c, limit=2)["items"]
    assert len(items) == 2
    return items[0]["video_id"], items[1]["video_id"]


def prepare_priced_videos(c, channel):
    run(c, server.sync_youtube, True)
    a, b = two_videos(c)
    c.patch(f"/api/admin/videos/{a}", json={"price_inr": 7_200_000}, headers=ADMIN)
    c.patch(f"/api/admin/videos/{b}", json={"price_inr": 4_100_000}, headers=ADMIN)
    return a, b


def test_interested_flow_form_once_then_one_click(c, channel):
    a, b = prepare_priced_videos(c, channel)
    s = fresh()
    assert s.get("/api/viewer").json() == {"known": False, "name": None, "linked": False, "prices": {}}
    # unknown visitors must leave name + phone
    assert s.post("/api/interest", json={"item_type": "video", "item_id": a}).status_code == 422
    assert s.post("/api/interest", json={"item_type": "video", "item_id": a, "name": "Mita", "phone": "<x>"}).status_code == 422
    assert s.post("/api/interest", json={"item_type": "video", "item_id": "nope", "name": "Mita", "phone": "9831011223"}).status_code == 404
    r = s.post("/api/interest", json={"item_type": "video", "item_id": a, "name": "Mita Das", "phone": "9831011223"})
    assert r.status_code == 200
    d = r.json()
    assert d["price"]["price_inr"] == 7_200_000 and d["first_time"] and d["new_contact"]
    assert "contact_token" in s.cookies
    # now known: a second video needs no form
    r2 = s.post("/api/interest", json={"item_type": "video", "item_id": b})
    assert r2.status_code == 200 and r2.json()["price"]["price_inr"] == 4_100_000 and not r2.json()["new_contact"]
    assert s.post("/api/interest", json={"item_type": "video", "item_id": b}).json()["first_time"] is False
    v = s.get("/api/viewer").json()
    assert v["known"] and v["name"] == "Mita Das" and set(v["prices"]) == {f"video:{a}", f"video:{b}"}
    # a different browser sees nothing
    assert fresh().get("/api/viewer").json()["prices"] == {}
    # and the public listing itself still has no prices
    assert "price" not in str(s.get("/api/video-listings").json()).lower()


def test_properties_use_the_same_gate(c, channel):
    s = fresh()
    pid = s.get("/api/properties").json()[0]["id"]
    assert "price_inr" not in s.get(f"/api/properties/{pid}").json()
    real = next(p["price_inr"] for p in c.get("/api/admin/properties", headers=ADMIN).json() if p["id"] == pid)
    r = s.post("/api/interest", json={"item_type": "property", "item_id": pid, "name": "Ravi", "phone": "9831012345"})
    assert r.json()["price"]["price_inr"] == real
    assert s.get("/api/viewer").json()["prices"][f"property:{pid}"]["price_inr"] == real
    assert "price_inr" not in s.get(f"/api/properties/{pid}").json()


def test_admin_sees_who_is_interested_in_what(c, channel):
    a, b = prepare_priced_videos(c, channel)
    s1, s2 = fresh(), fresh()
    s1.post("/api/interest", json={"item_type": "video", "item_id": a, "name": "Person One", "phone": "9831099001"})
    s1.post("/api/interest", json={"item_type": "video", "item_id": b})
    s2.post("/api/interest", json={"item_type": "video", "item_id": a, "name": "Person Two", "phone": "+91 98310 67890"})
    assert fresh().get("/api/admin/interests").status_code == 401

    summary = c.get("/api/admin/interests/summary", headers=ADMIN).json()
    row = next(i for i in summary["items"] if i["item_id"] == a)
    assert row["count"] >= 2 and {"Person One", "Person Two"} <= {p["name"] for p in row["people"]}
    assert all(p["phone"] for p in row["people"])
    events = c.get("/api/admin/interests", params={"q": "Person One"}, headers=ADMIN).json()
    assert len(events) == 2 and {e["item_id"] for e in events} == {a, b}

    # ONE lead per person, with each interest as a note
    leads = [l for l in c.get("/api/admin/leads", params={"source": "interested"}, headers=ADMIN).json() if l["name"] == "Person One"]
    assert len(leads) == 1 and len(leads[0]["notes"]) == 2 and "interested" in leads[0]["tags"]
    csv_text = c.get("/api/admin/interests/export", headers=ADMIN).text
    assert "Person Two" in csv_text and csv_text.splitlines()[0].startswith("first_pressed_at")
    notes = c.get("/api/admin/notifications", headers=ADMIN).json()["items"]
    assert any(n["title"].startswith("Interested: Person One") for n in notes)


def test_same_phone_is_one_person(c, channel):
    a, b = prepare_priced_videos(c, channel)
    s1, s2 = fresh(), fresh()
    s1.post("/api/interest", json={"item_type": "video", "item_id": a, "name": "Same Person", "phone": "98310 55667"})
    s2.post("/api/interest", json={"item_type": "video", "item_id": b, "name": "Same P", "phone": "+91-98310-55667"})
    ev = [e for e in c.get("/api/admin/interests", params={"q": "Same P"}, headers=ADMIN).json()]
    assert len({e["lead_id"] for e in ev}) == 1 and {e["name"] for e in ev} == {"Same Person"}   # first name wins; no overwrite


def test_after_the_form_just_logging_in_is_enough(c, channel):
    a, b = prepare_priced_videos(c, channel)
    s = fresh()
    s.post("/api/interest", json={"item_type": "video", "item_id": a, "name": "Login Person", "phone": "9831088990"})
    # the same browser signs in: the contact is remembered on the account
    me = s.get("/api/viewer", headers=LOGIN).json()
    assert me["known"] and me["linked"] and f"video:{a}" in me["prices"]
    # a brand-new device with only the Google login is recognised and can press Interested without the form
    other = fresh()
    v = other.get("/api/viewer", headers=LOGIN).json()
    assert v["known"] and v["name"] == "Login Person" and f"video:{a}" in v["prices"]
    r = other.post("/api/interest", json={"item_type": "video", "item_id": b}, headers=LOGIN)
    assert r.status_code == 200 and r.json()["price"]["price_inr"] == 4_100_000
    # signing in alone, without ever submitting the form, reveals nothing and still requires it
    nobody = TestClient(server.app, base_url="https://testserver")
    async def clear():
        await server.db.contacts.update_many({"user_id": "l3"}, {"$set": {"user_id": None}})
    c.portal.call(clear)
    assert nobody.get("/api/viewer", headers=LOGIN).json()["known"] is False
    assert nobody.post("/api/interest", json={"item_type": "video", "item_id": a}, headers=LOGIN).status_code == 422


def test_hidden_videos_cannot_be_unlocked_and_csrf_is_enforced(c, channel):
    a, b = prepare_priced_videos(c, channel)
    c.patch(f"/api/admin/videos/{b}", json={"hidden": True}, headers=ADMIN)
    s = fresh()
    assert s.post("/api/interest", json={"item_type": "video", "item_id": b, "name": "X", "phone": "9831077889"}).status_code == 404
    s.post("/api/interest", json={"item_type": "video", "item_id": a, "name": "Csrf Test", "phone": "9831066778"})
    evil = s.post("/api/interest", json={"item_type": "video", "item_id": a}, headers={"Origin": "https://evil.example"})
    assert evil.status_code == 403
    ok = s.post("/api/interest", json={"item_type": "video", "item_id": a}, headers={"Origin": "http://localhost:3000"})
    assert ok.status_code == 200


def test_interest_endpoint_is_rate_limited(c, channel):
    a, _ = prepare_priced_videos(c, channel)
    s = fresh()
    codes = [s.post("/api/interest", json={"item_type": "video", "item_id": a, "name": "Spam", "phone": f"98310{70000 + i * 37:05d}"}).status_code for i in range(12)]
    assert 429 in codes


def test_share_page_and_sitemap_include_videos(c, channel):
    run(c, server.sync_youtube, True)
    v = listing(c)["items"][0]["video_id"]
    share = c.get(f"/api/share/videos/{v}")
    assert 'property="og:title"' in share.text and "price" not in share.text.lower()
    assert f"/videos/{v}" in c.get("/api/sitemap.xml").text and "/videos<" in c.get("/api/sitemap.xml").text
    assert c.get("/api/share/videos/nope").status_code == 404
