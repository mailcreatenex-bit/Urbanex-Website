"""Offline tests: automatic blog posts written by Gemini, Gemini retries, and the Gemini-powered assistant (stubbed).

    pytest backend/tests/test_blog_offline.py -n 0
"""
import json
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402

os.environ.update(
    MONGO_URL="mongodb://offline", DB_NAME="offline_test8", CORS_ORIGINS="http://localhost:3000",
    ADMIN_EMAILS="admin@example.com", YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="",
    TURNSTILE_SECRET_KEY="", GEMINI_API_KEY="", GEMINI_RETRY_DELAY="0", UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-test-uploads-"),
)
import motor.motor_asyncio  # noqa: E402

motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

ADMIN = {"Authorization": "Bearer admin8-tok"}
PARA = ("Burdwan sits on the Grand Trunk Road and the main Howrah line, which is why connectivity news matters to people planning a home here. "
        "A proposed regional rapid transit or suburban rail link would shorten the trip to Kolkata, but until a project is sanctioned and funded it stays a proposal. ")
BODY = (PARA * 5)[:1500].rsplit(" ", 1)[0] + "."


def news_text(body=BODY, title="What new rail plans could mean for Burdwan buyers"):
    return f"TITLE: {title}\nEXCERPT: A careful look at proposed rail links and housing demand.\nBODY:\n{body}"


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            await server.db.users.update_one({"email": "admin@example.com"}, {"$set": {"user_id": "a8", "name": "Ayan", "is_admin": True}}, upsert=True)
            await server.db.user_sessions.update_one({"session_token": "admin8-tok"}, {"$set": {"user_id": "a8", "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        yield client


@pytest.fixture(autouse=True)
def _clean(c):
    server._hits.clear()
    for coll in (server.db.posts, server.db.videos):
        c.portal.call(lambda coll=coll: coll.delete_many({}))
    c.portal.call(lambda: server.db.settings.delete_many({"_id": {"$in": ["blog"]}}))


def rss(items):
    rows = "".join(f"<item><title>{h} - {o}</title><link>https://news.google.com/rss/articles/{i}</link><pubDate>{d}</pubDate><source url='https://x'>{o}</source></item>"
                   for i, (h, o, d) in enumerate(items))
    return f'<?xml version="1.0"?><rss><channel>{rows}</channel></rss>'


def recent(days):
    return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%a, %d %b %Y %H:%M:%S GMT")


HEADLINES = [("Kolkata RRTS: BJP proposes Namo Bharat-styled rapid trains linking South Bengal cities", "The Indian Express", recent(12)),
             ("West Bengal RRTS plan: four corridors explained", "urbanacres.in", recent(9)),
             ("Bardhaman railway station to get new facilities under redevelopment scheme", "The Times of India", recent(5)),
             ("Dog bites over 40 people in East Burdwan in one day", "The Times of India", recent(3)),                       # irrelevant: filtered out
             ("Old metro extension story", "Metro Rail News", recent(200))]                                                    # too old: filtered out


def ai(monkeypatch, handler, news=True):
    calls = []

    async def fake_news(url):
        return rss(HEADLINES) if news else rss([])

    monkeypatch.setattr(server, "news_get", fake_news)

    async def fake(prompt, system=None, *, json_out=True, search=False, temperature=0.0):
        calls.append({"prompt": prompt, "system": system, "search": search, "json": json_out})
        return handler(len(calls), prompt)

    monkeypatch.setattr(server, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(server, "gemini_call", fake)
    return calls


def add_video(c, vid, title, desc, days=0):
    item = {"id": vid, "snippet": {"title": title, "description": desc, "thumbnails": {},
                                   "publishedAt": (datetime.now(timezone.utc) - timedelta(days=days)).isoformat().replace("+00:00", "Z")},
            "contentDetails": {"duration": "PT3M"}}
    c.portal.call(server.upsert_video, item, list(server.BURDWAN_ZONES), {"new": 0, "updated": 0, "new_titles": []})


# ------------------------------------------------------------------ Gemini plumbing
def test_gemini_retries_when_busy_and_reports_sources(c, monkeypatch):
    monkeypatch.setattr(server, "GEMINI_API_KEY", "test-key")
    seq = [(503, {}), (200, {"candidates": [{"content": {"parts": [{"text": "hello "}, {"text": "world"}]},
                                                       "groundingMetadata": {"groundingChunks": [{"web": {"uri": "https://news.example/a", "title": "News A"}},
                                                                                                  {"web": {"uri": "https://news.example/a", "title": "dup"}},
                                                                                                  {"web": {"uri": "javascript:alert(1)", "title": "bad"}}]}}]})]
    sent = []

    async def post(payload, model=None):
        sent.append(payload)
        return seq[len(sent) - 1]

    monkeypatch.setattr(server, "gemini_post", post)
    monkeypatch.setattr(server, "GEMINI_FALLBACK_MODELS", [])
    res = c.portal.call(lambda: server.gemini_call("hi", system="sys", json_out=True, search=True))
    assert res == {"text": "hello world", "sources": [{"title": "News A", "url": "https://news.example/a"}]}
    assert len(sent) == 2 and sent[0]["tools"] == [{"google_search": {}}] and "responseMimeType" not in sent[0]["generationConfig"]   # grounding and JSON mode are exclusive
    assert sent[0]["systemInstruction"]["parts"][0]["text"] == "sys"

    async def always_down(payload, model=None):
        return 503, {}

    monkeypatch.setattr(server, "gemini_post", always_down)
    with pytest.raises(RuntimeError, match="503"):
        c.portal.call(server.gemini_call, "hi")

    async def forbidden(payload, model=None):
        sent.append(1)
        return 403, {}

    sent.clear()
    monkeypatch.setattr(server, "gemini_post", forbidden)
    with pytest.raises(RuntimeError, match="403"):
        c.portal.call(server.gemini_call, "hi")
    assert len(sent) == 1                                                                           # real errors are not retried

    # an overloaded main model falls through to the next model
    tried = []

    async def busy_then_ok(payload, model=None):
        tried.append(model)
        return (503, {}) if model == "main-model" else (200, {"candidates": [{"content": {"parts": [{"text": "from fallback"}]}}]})

    monkeypatch.setattr(server, "gemini_post", busy_then_ok)
    monkeypatch.setattr(server, "GEMINI_MODEL", "main-model")
    monkeypatch.setattr(server, "GEMINI_FALLBACK_MODELS", ["backup-model"])
    assert c.portal.call(server.gemini_call, "hi")["text"] == "from fallback"
    assert tried == ["main-model", "main-model", "backup-model"]


# ------------------------------------------------------------------ assistant now runs on Gemini
def test_assistant_uses_gemini_when_configured(c, monkeypatch):
    calls = ai(monkeypatch, lambda n, p: {"text": json.dumps({"reply": "Try the Goda flat.", "property_slugs": [], "action": None}), "sources": []})
    r = c.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": "3bhk near the station?"}]})
    assert r.status_code == 200 and r.json()["reply"] == "Try the Goda flat." and r.json()["ai"] is True
    assert calls[0]["system"].startswith("You are the Urbanex Realty assistant") and calls[0]["json"] and not calls[0]["search"]
    # when Gemini is down the keyword fallback still answers
    def down(n, p):
        raise RuntimeError("Gemini returned 503")
    ai(monkeypatch, down)
    r = c.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": "plot in Borehat"}]})
    assert r.status_code == 200 and r.json()["ai"] is False and r.json()["properties"]


# ------------------------------------------------------------------ automatic posts
def news_json(body=BODY, used=(1, 2), title="What new rail plans could mean for Burdwan buyers"):
    return json.dumps({"title": title, "excerpt": "A careful look at proposed rail links and housing demand.", "body": body, "used": list(used)})


def test_news_post_is_built_from_real_headlines_and_cleaned(c, monkeypatch):
    dirty = BODY.replace("proposal.", "proposal. <script>alert(1)</script> **Note** [official site](https://example.com) ", 1)
    calls = ai(monkeypatch, lambda n, p: {"text": news_json(dirty, used=[1, 3, 99]), "sources": []})
    r = c.post("/api/admin/posts/generate", json={"kind": "news"}, headers=ADMIN)
    assert r.status_code == 200, r.text
    post = r.json()
    prompt = calls[0]["prompt"]
    assert calls[0]["search"] is False and "REAL recent news headlines" in prompt and "never add details" in prompt
    assert "RRTS" in prompt and "Bardhaman railway station" in prompt
    assert "Dog bites" not in prompt and "Old metro extension" not in prompt                  # off-topic and stale headlines are filtered out
    assert post["category"] == "news" and post["generated"] and post["published"]
    assert [x["url"] for x in post["sources"]] == ["https://news.google.com/rss/articles/2", "https://news.google.com/rss/articles/0"]   # only the headlines it cited (n=99 ignored), newest first
    assert "Times of India" in post["sources"][0]["title"] and "Indian Express" in post["sources"][1]["title"]
    assert 1100 <= len(post["body"]) <= 2000
    assert "<script" not in post["body"] and "**" not in post["body"] and "](" not in post["body"] and "official site" in post["body"]
    pub = c.get(f"/api/posts/{post['slug']}").json()
    assert pub["title"].startswith("What new rail plans") and pub["videos"] == [] and len(pub["sources"]) == 2
    assert any(p["slug"] == post["slug"] for p in c.get("/api/posts").json())
    assert c.post("/api/admin/posts/generate", json={}).status_code == 401


def test_news_that_cites_nothing_is_rejected_and_thin_news_becomes_a_guide(c, monkeypatch):
    ai(monkeypatch, lambda n, p: {"text": news_json(used=[]), "sources": []})
    r = c.post("/api/admin/posts/generate", json={"kind": "news"}, headers=ADMIN)
    assert r.status_code == 502 and "cite" in r.json()["detail"]
    assert c.portal.call(lambda: server.db.posts.count_documents({})) == 0
    assert c.get("/api/admin/blog/settings", headers=ADMIN).json()["last_error"]
    # fewer than 3 usable headlines: an evergreen guide is written instead (no invented news)
    calls = ai(monkeypatch, lambda n, p: {"text": news_text(), "sources": []}, news=False)
    post = c.post("/api/admin/posts/generate", json={"kind": "news"}, headers=ADMIN).json()
    assert post["kind"] == "guide" and post["category"] == "buying-guide" and post["sources"] == []
    assert "do NOT quote specific fee percentages" in calls[0]["prompt"] and calls[0]["json"] is False


def test_length_is_enforced_with_one_rewrite(c, monkeypatch):
    short = news_text("Too short.")
    calls = ai(monkeypatch, lambda n, p: {"text": short if n == 1 else news_text(), "sources": []})
    r = c.post("/api/admin/posts/generate", json={"kind": "guide"}, headers=ADMIN)
    assert r.status_code == 200 and len(calls) == 2 and "Your last body had 10 characters" in calls[1]["prompt"]
    assert r.json()["category"] == "buying-guide"
    ai(monkeypatch, lambda n, p: {"text": short, "sources": []})
    assert c.post("/api/admin/posts/generate", json={"kind": "guide"}, headers=ADMIN).status_code == 502      # still unusable after the rewrite


def test_video_post_links_the_videos_and_never_sees_prices(c, monkeypatch):
    add_video(c, "PLOTVIDEO001", "Plot near Police Line Burdwan", "Corner plot of 5 katha near Police Line. Price: 40 lakh. Clear title.", days=1)
    add_video(c, "PLOTVIDEO002", "Another plot at Police Line", "East facing 4 katha plot, wide road. Rs. 35 Lakh negotiable.", days=2)
    add_video(c, "PLOTVIDEO003", "Third plot in Police Line area", "3 katha plot, ready for registration. ₹28 lakh.", days=3)
    add_video(c, "FLATVIDEO004", "2BHK flat", "short", days=4)                                           # description too thin to write about
    body = (("Near Police Line in Burdwan, three plots caught our eye this week. " * 24)[:1450]).strip() + "."
    calls = ai(monkeypatch, lambda n, p: {"text": json.dumps({"title": "Three plots near Police Line, Burdwan", "excerpt": "What the new videos show.",
                                                              "body": body, "video_ids": ["PLOTVIDEO001", "PLOTVIDEO002", "PLOTVIDEO003", "BOGUSVIDEO99"]}), "sources": []})
    r = c.post("/api/admin/posts/generate", json={"kind": "video"}, headers=ADMIN)
    assert r.status_code == 200, r.text
    post = r.json()
    assert post["category"] == "area-guide" and post["video_ids"] == ["PLOTVIDEO001", "PLOTVIDEO002", "PLOTVIDEO003"] and not calls[0]["search"]   # bogus id dropped
    assert "lakh" not in calls[0]["prompt"].lower() and "₹" not in calls[0]["prompt"] and "Price:" not in calls[0]["prompt"]      # prices never reach the model
    assert "Police Line" in calls[0]["prompt"] and "never mention or guess any price" in calls[0]["prompt"]
    pub = c.get(f"/api/posts/{post['slug']}").json()
    assert [v["video_id"] for v in pub["videos"]] == ["PLOTVIDEO001", "PLOTVIDEO002", "PLOTVIDEO003"]
    assert "price" not in str(pub["videos"]).lower()
    # a hidden video disappears from the article
    c.patch("/api/admin/videos/PLOTVIDEO002", json={"hidden": True}, headers=ADMIN)
    assert [v["video_id"] for v in c.get(f"/api/posts/{post['slug']}").json()["videos"]] == ["PLOTVIDEO001", "PLOTVIDEO003"]
    # the same videos are not written about twice: the next video post falls back to news
    ai(monkeypatch, lambda n, p: {"text": news_json(), "sources": []})
    again = c.post("/api/admin/posts/generate", json={"kind": "video"}, headers=ADMIN).json()
    assert again["kind"] == "news" and len(again["sources"]) == 2


def test_rotation_schedule_and_review_mode(c, monkeypatch):
    ai(monkeypatch, lambda n, p: {"text": news_json(), "sources": []})
    st = c.get("/api/admin/blog/settings", headers=ADMIN).json()
    assert st["every_days"] == 3 and st["auto_publish"] is True and st["ai_enabled"] and st["rotation"] == ["news", "video", "news", "guide"]
    assert server.blog_due(server.__dict__["blog_settings"] and c.portal.call(server.blog_settings)) is True            # never written yet: due now
    now = datetime.now(timezone.utc)
    base = {"enabled": True, "every_days": 3, "auto_publish": True, "cursor": 0, "last_error": None, "last_attempt_at": None}
    assert server.blog_due({**base, "last_run_at": (now - timedelta(days=2, hours=23)).isoformat()}) is False
    assert server.blog_due({**base, "last_run_at": (now - timedelta(days=3, minutes=1)).isoformat()}) is True
    assert server.blog_due({**base, "enabled": False, "last_run_at": None}) is False
    failed = {**base, "last_run_at": (now - timedelta(days=9)).isoformat(), "last_error": "boom"}
    assert server.blog_due({**failed, "last_attempt_at": (now - timedelta(hours=1)).isoformat()}) is False             # failures back off
    assert server.blog_due({**failed, "last_attempt_at": (now - timedelta(hours=7)).isoformat()}) is True
    # review mode: the post is saved as a draft and stays private until the admin publishes it
    assert c.put("/api/admin/blog/settings", json={"auto_publish": False, "every_days": 5}, headers=ADMIN).json()["every_days"] == 5
    post = c.post("/api/admin/posts/generate", json={}, headers=ADMIN).json()
    assert post["published"] is False and c.get(f"/api/posts/{post['slug']}").status_code == 404
    assert c.get("/api/admin/blog/settings", headers=ADMIN).json()["cursor"] == 1
    assert c.put("/api/admin/blog/settings", json={"every_days": 99}, headers=ADMIN).status_code == 422
    assert c.patch(f"/api/admin/posts/{post['id']}", json={"published": True}, headers=ADMIN).json()["published"] is True
    assert c.get(f"/api/posts/{post['slug']}").status_code == 200


def test_generation_needs_a_key_and_unusable_answers_are_rejected(c, monkeypatch):
    r = c.post("/api/admin/posts/generate", json={}, headers=ADMIN)
    assert r.status_code == 502 and "GEMINI_API_KEY" in r.json()["detail"]
    ai(monkeypatch, lambda n, p: {"text": "Sorry, I cannot help with that.", "sources": []})
    r = c.post("/api/admin/posts/generate", json={"kind": "guide"}, headers=ADMIN)
    assert r.status_code == 502 and "format" in r.json()["detail"]
    ai(monkeypatch, lambda n, p: {"text": "not json at all", "sources": []})
    add_video(c, "VIDEOAAAAA01", "Plot in Goda", "Spacious plot in Goda near the main road with clear papers.")
    assert c.post("/api/admin/posts/generate", json={"kind": "video"}, headers=ADMIN).status_code == 502
