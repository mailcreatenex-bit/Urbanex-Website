"""Security checks that run on every change: who may call what, headers, limits, injection, SSRF.
    pytest backend/tests/test_security_sweep_offline.py -n 0"""
import inspect
import os
import re
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.routing import APIRoute  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_security", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="", TURNSTILE_SECRET_KEY="",
                  CALL_WEBHOOK_SECRET="s3cret-for-tests", UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-sec-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

ADMIN = {"Authorization": "Bearer sec-admin"}
USER = {"Authorization": "Bearer sec-user"}
ROUTES = [r for r in server.api.routes if isinstance(r, APIRoute)]
# routes that are open on purpose (public pages, sign-in, webhooks that check their own key or signature)
PUBLIC_ADMINISH = set()


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app, raise_server_exceptions=False) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            for uid, email, name, tok, admin in (("sa", "admin@example.com", "Ayan", "sec-admin", True), ("su", "visitor@example.com", "Visitor", "sec-user", False)):
                await server.db.users.update_one({"email": email}, {"$set": {"user_id": uid, "name": name, "is_admin": admin}}, upsert=True)
                await server.db.user_sessions.update_one({"session_token": tok}, {"$set": {"user_id": uid, "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        yield client


@pytest.fixture(autouse=True)
def fresh_limits():
    server._hits.clear()


def fill(path):
    return re.sub(r"\{[^}]+\}", "x1x1x1x1x1x1x1x1", path)


def test_every_admin_handler_checks_who_is_asking():
    unguarded = [f"{sorted(r.methods)} {r.path}" for r in ROUTES if "/admin" in r.path and "require_admin" not in inspect.getsource(r.endpoint)]
    assert unguarded == []


def test_every_owner_handler_needs_a_signed_in_user():
    unguarded = [r.path for r in ROUTES if "/owner" in r.path and not re.search(r"require_user|require_admin", inspect.getsource(r.endpoint))]
    assert unguarded == []


@pytest.mark.parametrize("prefix", ["/api/admin", "/api/owner"])
def test_no_login_means_401_or_validation_never_data(c, prefix):
    for r in ROUTES:
        if not r.path.startswith(prefix):
            continue
        for m in r.methods - {"HEAD", "OPTIONS"}:
            resp = c.request(m, fill(r.path), json={} if m in ("POST", "PUT", "PATCH") else None)
            assert resp.status_code in (401, 403, 422), f"{m} {r.path} answered {resp.status_code} without a login"
            if m == "GET":
                assert resp.status_code != 200, f"GET {r.path} returned data without a login"


def test_an_ordinary_signed_in_visitor_is_not_an_admin(c):
    for r in ROUTES:
        if not r.path.startswith("/api/admin"):
            continue
        if "GET" in r.methods:
            resp = c.get(fill(r.path), headers=USER)
            assert resp.status_code in (401, 403, 422), f"GET {r.path} let an ordinary visitor in ({resp.status_code})"


def test_security_headers_and_no_store(c):
    r = c.get("/api/properties")
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
    assert "max-age" in r.headers["strict-transport-security"] and r.headers["referrer-policy"]
    a = c.get("/api/admin/leads", headers=ADMIN)
    assert a.status_code == 200 and a.headers["cache-control"] == "no-store"


def test_cookie_requests_from_another_site_are_refused(c):
    r = c.post("/api/auth/logout", headers={"Origin": "https://evil.example"}, cookies={"session_token": "sec-admin"})
    assert r.status_code == 403
    ok = c.post("/api/auth/logout", headers={"Origin": "http://localhost:3000"}, cookies={"session_token": "sec-user"})
    assert ok.status_code == 200


def test_rate_limit_is_per_visitor_behind_a_proxy(c, monkeypatch):
    monkeypatch.setattr(server, "TRUST_PROXY", True)
    body = {"name": "Spam Tester", "phone": "9831099001", "source_page": "contact"}
    codes = [c.post("/api/leads", json=body, headers={"X-Forwarded-For": "203.0.113.7"}).status_code for _ in range(12)]
    assert 429 in codes                                                        # that visitor is slowed down...
    other = c.post("/api/leads", json={**body, "phone": "9831099002"}, headers={"X-Forwarded-For": "198.51.100.9"})
    assert other.status_code == 200                                            # ...and everybody else still gets through


def test_a_forged_address_header_is_ignored_unless_we_sit_behind_a_proxy(c, monkeypatch):
    monkeypatch.setattr(server, "TRUST_PROXY", False)
    body = {"name": "Spam Tester", "phone": "9831099003", "source_page": "contact"}
    codes = [c.post("/api/leads", json=body, headers={"X-Forwarded-For": f"10.9.9.{i}"}).status_code for i in range(12)]
    assert 429 in codes                                                        # changing the header does not buy more requests


def test_huge_bodies_are_refused(c):
    r = c.post("/api/leads", content=b"x" * 10, headers={"Content-Length": str(50 * 1024 * 1024), "Content-Type": "application/json"})
    assert r.status_code == 413
    big = c.post("/api/leads", content=b"{}", headers={"Content-Length": str(3 * 1024 * 1024), "Content-Type": "application/json"})
    assert big.status_code == 413


def test_webhook_key_cannot_be_guessed_by_trying_again_and_again(c, monkeypatch):
    monkeypatch.setattr(server, "CALL_WEBHOOK_SECRET", "s3cret-for-tests")
    body = {"call_id": "c1", "recording_url": "https://example.com/a.mp3"}
    codes = [c.post("/api/calls/webhook", json=body, headers={"X-Webhook-Key": f"guess-{i}"}).status_code for i in range(40)]
    assert set(codes[:30]) == {401} and 429 in codes[30:]


@pytest.mark.parametrize("url,ok", [("https://example.com/a.mp3", True), ("http://example.com/a.mp3", False), ("https://localhost/a.mp3", False),
                                    ("https://127.0.0.1/a.mp3", False), ("https://10.0.0.5/a.mp3", False), ("https://169.254.169.254/latest/meta-data", False),
                                    ("https://[::1]/a.mp3", False), ("file:///etc/passwd", False)])
def test_recording_links_must_be_public_https(url, ok):
    assert server.safe_recording_url(url) is ok


def test_names_that_resolve_to_private_addresses_are_refused(c):
    for host in ("localhost", "127.0.0.1", "0.0.0.0"):
        assert c.portal.call(server.host_is_public, host) is False


def test_query_operators_in_urls_do_nothing_special(c):
    for q in ("zone[$ne]=x", "q[$regex]=.*", "property_type[$gt]=", "status=%24ne"):
        r = c.get(f"/api/properties?{q}")
        assert r.status_code in (200, 422)
    r = c.post("/api/leads", json={"name": {"$ne": "x"}, "phone": "9831099010", "source_page": "contact"})
    assert r.status_code == 422


def test_scripts_in_a_title_are_escaped_on_share_pages(c):
    evil = '"><script>alert(1)</script><img src=x onerror=alert(2)>'
    r = c.post("/api/admin/properties", headers=ADMIN, json={"title": evil, "zone": "Goda", "property_type": "plot", "area_sqft": 1000, "description": evil, "status": "available"})
    assert r.status_code in (200, 201), r.text
    slug = r.json().get("slug") or r.json().get("id")
    page = c.get(f"/api/share/properties/{slug}")
    assert page.status_code == 200 and "<script>" not in page.text and "<img src=x" not in page.text


def test_uploaded_files_cannot_climb_out_of_the_folder(c):
    for bad in ("..%2F..%2Fserver.py", "%2e%2e%2fserver.py", "....//server.py", "a/b.png"):
        assert c.get(f"/api/uploads/{bad}").status_code in (404, 422)


def test_the_docs_can_be_switched_off():
    src = inspect.getsource(server)
    assert "DISABLE_DOCS" in src and 'docs_url=None if DISABLE_DOCS' in src
