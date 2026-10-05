"""Offline tests for how API keys are protected.

    pytest backend/tests/test_security_offline.py -n 0
"""
import logging
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402

os.environ.update(
    MONGO_URL="mongodb://offline", DB_NAME="offline_test7", CORS_ORIGINS="http://localhost:3000",
    ADMIN_EMAILS="admin@example.com", YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="",
    TURNSTILE_SECRET_KEY="", GEMINI_API_KEY="", AI_BATCH_PAUSE="0", UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-test-uploads-"),
)
import motor.motor_asyncio  # noqa: E402

motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
import server  # noqa: E402

ADMIN = {"Authorization": "Bearer admin7-tok"}
FAKE = {  # realistic shapes, obviously not real
    "YOUTUBE_API_KEY": "AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKE12345",
    "GEMINI_API_KEY": "AQ.FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE12345678",
    "EMERGENT_LLM_KEY": "sk-emergent-FAKEFAKEFAKEFAKE",
    "SMTP_PASSWORD": "smtp-pass-FAKE-12345",
    "TURNSTILE_SECRET": "0x4AAAAAAAFAKEFAKEFAKEFAKE",
}


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        async def seed():
            exp = datetime.now(timezone.utc) + timedelta(days=1)
            await server.db.users.update_one({"email": "admin@example.com"}, {"$set": {"user_id": "a7", "name": "Ayan", "is_admin": True}}, upsert=True)
            await server.db.user_sessions.update_one({"session_token": "admin7-tok"}, {"$set": {"user_id": "a7", "expires_at": exp}}, upsert=True)
        client.portal.call(seed)
        yield client


def test_repository_contains_no_secrets_and_env_files_are_ignored():
    scan = subprocess.run([sys.executable, str(ROOT / "scripts" / "scan_secrets.py")], capture_output=True, text=True)
    assert scan.returncode == 0, scan.stdout
    ignored = subprocess.run(["git", "check-ignore", "backend/.env", "frontend/.env"], cwd=ROOT, capture_output=True, text=True)
    assert ignored.returncode == 0 and "backend/.env" in ignored.stdout
    tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.splitlines()
    assert not [f for f in tracked if f.endswith(".env") or f.split("/")[-1] == ".env"]


def test_scanner_catches_new_secrets(tmp_path):
    sys.path.insert(0, str(ROOT / "scripts"))
    import scan_secrets
    hits = []
    scan_secrets.scan_text("x.js", f'const k = "{FAKE["YOUTUBE_API_KEY"]}"; // and {FAKE["GEMINI_API_KEY"]} and {FAKE["EMERGENT_LLM_KEY"]}', hits)
    assert len(hits) == 3 and all("FAKE" not in h for h in hits)          # reported, but never printed in full
    hits = []
    scan_secrets.scan_text("config.py", 'password = "correct-horse-battery-staple-123"\nmongo = "mongodb://root:hunter2@db/x"', hits)
    assert len(hits) == 2
    hits = []
    scan_secrets.scan_text("ok.py", 'api_key = os.environ["X"]\nNAME = ""\n', hits)
    assert hits == []


def test_redaction_removes_keys_from_any_text(monkeypatch):
    for name, value in FAKE.items():
        monkeypatch.setattr(server, name, value)
    text = " | ".join([
        f"GET https://www.googleapis.com/youtube/v3/channels?part=id&key={FAKE['YOUTUBE_API_KEY']} failed",
        f"Bearer {FAKE['GEMINI_API_KEY']}", f"login {FAKE['SMTP_PASSWORD']} rejected", f"secret={FAKE['TURNSTILE_SECRET']}",
        "mongodb://admin:hunter2@cluster.example/db", "-----BEGIN PRIVATE KEY-----\nMIIabc\n-----END PRIVATE KEY-----", "plain text 3bhk flat in Goda",
    ])
    out = server.redact(text)
    for value in FAKE.values():
        assert value not in out
    assert "hunter2" not in out and "MIIabc" not in out and "plain text 3bhk flat in Goda" in out


def test_log_output_never_contains_keys(monkeypatch, caplog):
    monkeypatch.setattr(server, "GEMINI_API_KEY", FAKE["GEMINI_API_KEY"])
    log = logging.getLogger("test_secret_logger")
    handler = logging.StreamHandler()
    handler.addFilter(server.RedactFilter())
    seen = []
    handler.emit = lambda record: seen.append(handler.format(record))
    log.addHandler(handler)
    log.warning("request failed key=%s and %s", FAKE["YOUTUBE_API_KEY"], FAKE["GEMINI_API_KEY"])
    log.removeHandler(handler)
    assert seen and FAKE["YOUTUBE_API_KEY"] not in seen[0] and FAKE["GEMINI_API_KEY"] not in seen[0] and "[redacted]" in seen[0]


def test_errors_stored_or_returned_by_the_api_are_redacted(c, monkeypatch):
    monkeypatch.setattr(server, "YOUTUBE_API_KEY", FAKE["YOUTUBE_API_KEY"])

    async def boom(path, params):
        raise RuntimeError(f"upstream said: invalid key {FAKE['YOUTUBE_API_KEY']} (url ...?key={FAKE['YOUTUBE_API_KEY']})")

    monkeypatch.setattr(server, "yt_get", boom)
    monkeypatch.setattr(server, "YOUTUBE_PUBLIC_FEED", False)
    res = c.post("/api/admin/videos/sync", json={}, headers=ADMIN).json()
    assert res["ok"] is False and FAKE["YOUTUBE_API_KEY"] not in str(res)
    status = c.get("/api/admin/videos", headers=ADMIN)
    assert FAKE["YOUTUBE_API_KEY"] not in status.text


def test_no_endpoint_ever_returns_a_configured_secret(c, monkeypatch):
    for name, value in FAKE.items():
        monkeypatch.setattr(server, name, value)
    monkeypatch.setattr(server, "SMTP_HOST", "smtp.example.com")
    urls = ["/api/", "/api/config/public", "/api/properties", "/api/videos", "/api/video-listings", "/api/viewer", "/api/push/key", "/api/sitemap.xml"]
    admin_urls = ["/api/admin/videos", "/api/admin/push", "/api/admin/digest", "/api/admin/leads", "/api/admin/notifications", "/api/admin/interests/summary"]
    for u in urls:
        assert all(v not in c.get(u).text for v in FAKE.values()), u
    for u in admin_urls:
        r = c.get(u, headers=ADMIN)
        assert r.status_code == 200 and all(v not in r.text for v in FAKE.values()), u
    info = c.get("/api/admin/videos", headers=ADMIN).json()
    assert info["ai"]["enabled"] is True and "key" not in str(info["ai"]).lower().replace("last_error", "")   # reports on/off, never the key
    assert info["sync"]["configured"] is True


def test_secrets_can_come_from_mounted_files(tmp_path, monkeypatch):
    f = tmp_path / "gemini.txt"
    f.write_text("  AQ.FROM-A-SECRET-FILE-1234567890123456789  \n")
    monkeypatch.setenv("SOME_SECRET_FILE", str(f))
    assert server.secret("SOME_SECRET") == "AQ.FROM-A-SECRET-FILE-1234567890123456789"
    monkeypatch.delenv("SOME_SECRET_FILE")
    monkeypatch.setenv("SOME_SECRET", "from-env")
    assert server.secret("SOME_SECRET") == "from-env" and server.secret("NOT_SET_ANYWHERE", "dflt") == "dflt"


def test_gemini_calls_have_a_daily_cap(c, monkeypatch):
    c.portal.call(lambda: server.db.settings.delete_many({"_id": {"$regex": "^gemini_usage_"}}))
    monkeypatch.setattr(server, "GEMINI_API_KEY", FAKE["GEMINI_API_KEY"])
    monkeypatch.setattr(server, "GEMINI_DAILY_LIMIT", 0)
    with pytest.raises(RuntimeError, match="Daily AI limit"):
        c.portal.call(server.gemini_json, "hello")           # refused before any network call is made
    count = c.portal.call(lambda: server.db.settings.find_one({"_id": {"$regex": "^gemini_usage_"}}))
    assert count["n"] == 1
