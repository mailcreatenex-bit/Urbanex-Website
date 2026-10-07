"""On free hosting the disk is wiped at every restart: uploads are also kept in the database and served from there.
    pytest backend/tests/test_uploads_persist_offline.py -n 0"""
import os
import sys
import tempfile
from pathlib import Path

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402
import motor.motor_asyncio  # noqa: E402

os.environ.update(MONGO_URL="mongodb://offline", DB_NAME="offline_uploads", CORS_ORIGINS="http://localhost:3000", ADMIN_EMAILS="admin@example.com",
                  YOUTUBE_API_KEY="", YOUTUBE_PUBLIC_FEED="0", SMTP_HOST="", ALERT_WEBHOOK_URL="", GEMINI_API_KEY="", TURNSTILE_SECRET_KEY="",
                  UPLOAD_DIR=tempfile.mkdtemp(prefix="urbx-up-"))
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

PNG = b"\x89PNG\r\n\x1a\n" + b"1" * 200
NAME = "a1b2c3d4e5f60718293a4b5c6d7e8f90.png"


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        yield client


def test_a_file_survives_the_disk_being_wiped(c, monkeypatch):
    monkeypatch.setattr(server, "UPLOADS_IN_DB", True)
    c.portal.call(server.store_upload, NAME, PNG)
    (server.UPLOAD_DIR / NAME).unlink()                                    # a restart on a free host
    r = c.get(f"/api/uploads/{NAME}")
    assert r.status_code == 200 and r.content == PNG and r.headers["content-type"] == "image/png"
    assert (server.UPLOAD_DIR / NAME).is_file()                            # put back on disk for the next request


def test_without_the_database_copy_a_wiped_file_is_gone(c, monkeypatch):
    monkeypatch.setattr(server, "UPLOADS_IN_DB", False)
    name = "ffeeddccbbaa99887766554433221100.png"
    c.portal.call(server.store_upload, name, PNG)
    (server.UPLOAD_DIR / name).unlink()
    assert c.get(f"/api/uploads/{name}").status_code == 404


def test_odd_names_are_refused(c):
    for bad in ("x.png", "..%2Fserver.py", "a1b2c3d4e5f60718293a4b5c6d7e8f90.exe", "a1b2c3d4e5f60718293a4b5c6d7e8f90.PNG"):
        assert c.get(f"/api/uploads/{bad}").status_code in (404, 422)
