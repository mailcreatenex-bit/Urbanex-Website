"""Urbanex Realty backend API tests.

Covers:
- Public config, properties, videos endpoints
- Public lead creation + persistence
- Auth gating on admin endpoints (401 without / 200 with bearer)
- Admin lead update, notes, semantic search, CSV export
- Reports overview
- Invoices create + list (URBX-YYYY-NNNN format)
- /auth/me with and without bearer token
"""
import os
import re
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ayan-dey-realty.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_TOKEN = "adm_test_token_123"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_s(s):
    sess = requests.Session()
    sess.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ADMIN_TOKEN}",
    })
    return sess


# ---------------- Public content ----------------
class TestPublicContent:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_config_public(self, s):
        r = s.get(f"{API}/config/public")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("zones"), list)
        assert len(data["zones"]) == 19, f"expected 19 zones, got {len(data['zones'])}"
        assert data["brand"]["name"] == "Urbanex Realty"
        assert data["brand"]["founder"] == "Ayan Dey"
        assert data["brand"]["city"] == "Burdwan"
        assert data.get("whatsapp")

    def test_properties_list(self, s):
        r = s.get(f"{API}/properties")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 12, f"expected >=12 properties, got {len(data)}"
        p = data[0]
        for k in ["id", "title", "zone", "price_inr", "image", "gallery"]:
            assert k in p, f"property missing key {k}"
        assert isinstance(p["gallery"], list) and len(p["gallery"]) >= 1

    def test_property_by_id(self, s):
        lst = s.get(f"{API}/properties").json()
        pid = lst[0]["id"]
        r = s.get(f"{API}/properties/{pid}")
        assert r.status_code == 200
        assert r.json()["id"] == pid

    def test_property_not_found(self, s):
        r = s.get(f"{API}/properties/does_not_exist_xyz")
        assert r.status_code == 404

    def test_properties_filter_by_zone(self, s):
        r = s.get(f"{API}/properties", params={"zone": "Kalibazar"})
        assert r.status_code == 200
        data = r.json()
        assert all(p["zone"] == "Kalibazar" for p in data)

    def test_videos(self, s):
        r = s.get(f"{API}/videos")
        assert r.status_code == 200
        vids = r.json()
        assert isinstance(vids, list)
        assert len(vids) >= 1, "expected at least one video (yt or fallback)"
        v = vids[0]
        for k in ["video_id", "title", "thumbnail"]:
            assert k in v


# ---------------- Auth ----------------
class TestAuth:
    def test_me_without_token(self, s):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_bearer(self, admin_s):
        r = admin_s.get(f"{API}/auth/me")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == "ayan@urbanex.com"
        assert data["is_admin"] is True

    def test_session_missing_id(self, s):
        r = s.post(f"{API}/auth/session", json={})
        assert r.status_code == 400


# ---------------- Public lead ----------------
class TestLeadCreation:
    _created_id = None

    def test_create_lead(self, s):
        payload = {
            "name": "TEST_Prospect",
            "phone": "9999900001",
            "email": "TEST_prospect@example.com",
            "source_page": "contact",
            "property_interest": "Kalibazar Boutique Villa",
            "message": "TEST_pytest lead",
        }
        r = s.post(f"{API}/leads", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["id"].startswith("lead_")
        TestLeadCreation._created_id = data["id"]

    def test_lead_persisted_visible_to_admin(self, admin_s):
        assert TestLeadCreation._created_id, "create_lead must run first"
        r = admin_s.get(f"{API}/admin/leads", params={"q": "TEST_pytest"})
        assert r.status_code == 200
        ids = [l["id"] for l in r.json()]
        assert TestLeadCreation._created_id in ids


# ---------------- Admin auth gating ----------------
class TestAdminAuthGating:
    endpoints = [
        ("GET", "/admin/leads"),
        ("GET", "/admin/leads/export"),
        ("GET", "/admin/reports/overview"),
        ("GET", "/admin/invoices"),
    ]

    @pytest.mark.parametrize("method,path", endpoints)
    def test_requires_auth(self, method, path):
        r = requests.request(method, f"{API}{path}")
        assert r.status_code == 401, f"{path} should require auth, got {r.status_code}"


# ---------------- Admin leads flow ----------------
class TestAdminLeadsFlow:
    _lid = None

    def test_admin_leads_list_ok(self, admin_s):
        r = admin_s.get(f"{API}/admin/leads")
        assert r.status_code == 200
        leads = r.json()
        assert isinstance(leads, list)
        assert len(leads) >= 1
        TestAdminLeadsFlow._lid = leads[0]["id"]

    def test_update_lead_status(self, admin_s):
        assert TestAdminLeadsFlow._lid
        r = admin_s.patch(f"{API}/admin/leads/{TestAdminLeadsFlow._lid}", json={"status": "contacted"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "contacted"
        # verify persisted
        r2 = admin_s.get(f"{API}/admin/leads")
        row = next(l for l in r2.json() if l["id"] == TestAdminLeadsFlow._lid)
        assert row["status"] == "contacted"

    def test_add_note(self, admin_s):
        assert TestAdminLeadsFlow._lid
        r = admin_s.post(
            f"{API}/admin/leads/{TestAdminLeadsFlow._lid}/notes",
            json={"text": "TEST_note pytest"},
        )
        assert r.status_code == 200, r.text
        entry = r.json()
        assert entry["text"] == "TEST_note pytest"
        assert entry["author"] == "ayan@urbanex.com"
        assert entry["id"].startswith("note_")

    def test_update_lead_not_found(self, admin_s):
        r = admin_s.patch(f"{API}/admin/leads/lead_missing_xyz", json={"status": "contacted"})
        assert r.status_code == 404

    def test_export_csv(self, admin_s):
        r = admin_s.get(f"{API}/admin/leads/export")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "")
        body = r.text
        assert body.startswith("id,name,phone,email,source_page,property_interest,status,message,created_at")

    def test_semantic_search(self, admin_s):
        r = admin_s.post(f"{API}/admin/leads/semantic", json={"query": "Kalibazar villa"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "matches" in data
        assert "reasoning" in data
        assert isinstance(data["matches"], list)


# ---------------- Reports ----------------
class TestReports:
    def test_overview(self, admin_s):
        r = admin_s.get(f"{API}/admin/reports/overview")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["total_leads", "by_status", "by_source", "by_day", "zones_heat"]:
            assert k in data
        assert isinstance(data["total_leads"], int)
        assert isinstance(data["by_status"], list)
        assert isinstance(data["zones_heat"], list)


# ---------------- Invoices ----------------
class TestInvoices:
    _num = None

    def test_create_invoice(self, admin_s):
        r = admin_s.post(f"{API}/admin/invoices", json={
            "client_name": "TEST_Client",
            "client_email": "TEST_client@example.com",
            "client_phone": "9911223344",
            "property_title": "Renaissance Residency 3BHK",
            "amount_inr": 500000,
            "payment_schedule": "20% booking / 30% slab / 50% possession",
            "notes": "TEST invoice",
        })
        assert r.status_code == 200, r.text
        inv = r.json()
        assert re.match(r"^URBX-\d{4}-\d{4}$", inv["invoice_number"]), inv["invoice_number"]
        assert inv["amount_inr"] == 500000
        assert inv["id"].startswith("inv_")
        TestInvoices._num = inv["invoice_number"]

    def test_list_invoices(self, admin_s):
        r = admin_s.get(f"{API}/admin/invoices")
        assert r.status_code == 200
        nums = [i["invoice_number"] for i in r.json()]
        assert TestInvoices._num in nums
