"""SIES FinCore backend regression tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://college-treasury.preview.emergentagent.com").rstrip("/")

ADMIN = ("iamyourguestbro@gmail.com", "SiesFin@2026")
FINANCE = ("finance@sies.edu.in", "Sies@2026")
AUDITOR = ("auditor@sies.edu.in", "Sies@2026")
PROCUREMENT = ("procurement@sies.edu.in", "Sies@2026")


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    assert "access_token" in s.cookies, f"no access_token cookie set for {email}"
    return s


@pytest.fixture(scope="module")
def admin(): return _login(*ADMIN)
@pytest.fixture(scope="module")
def finance(): return _login(*FINANCE)
@pytest.fixture(scope="module")
def auditor(): return _login(*AUDITOR)
@pytest.fixture(scope="module")
def procurement(): return _login(*PROCUREMENT)


# ---------- Health & Auth ----------
class TestHealthAuth:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code == 200 and r.json()["status"] == "ok"

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "nope@x.com", "password": "bad"}, timeout=10)
        assert r.status_code == 401

    def test_me(self, admin):
        r = admin.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "super_admin"


# ---------- Dashboard / Analytics ----------
class TestDashboard:
    def test_dashboard(self, admin):
        r = admin.get(f"{BASE_URL}/api/dashboard", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Expect KPI-like fields
        assert isinstance(data, dict) and data, "empty dashboard"

    def test_analytics_kpis(self, admin):
        r = admin.get(f"{BASE_URL}/api/analytics/kpis", timeout=15)
        assert r.status_code == 200, r.text

    def test_analytics_forecast(self, admin):
        r = admin.get(f"{BASE_URL}/api/analytics/forecast", timeout=15)
        assert r.status_code == 200, r.text


# ---------- Accounting Engine ----------
class TestAccounting:
    def test_trial_balance_balanced(self, admin):
        r = admin.get(f"{BASE_URL}/api/trial-balance", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("balanced") is True
        assert round(float(d.get("total_debit", 0)) - float(d.get("total_credit", 0)), 2) == 0

    def test_financial_statements(self, admin):
        r = admin.get(f"{BASE_URL}/api/financial-statements", timeout=15)
        assert r.status_code == 200, r.text

    def test_journals_list(self, admin):
        r = admin.get(f"{BASE_URL}/api/journals", timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data.get("items") if isinstance(data, dict) else data
        assert items, "no journal entries returned"
        # Fetch full journal and confirm balanced
        jno = items[0].get("journal_no")
        r2 = admin.get(f"{BASE_URL}/api/journals/{jno}", timeout=15)
        assert r2.status_code == 200
        j = r2.json()
        lines = j.get("lines", [])
        assert lines
        def _num(v):
            if isinstance(v, dict): return float(v.get("$numberDecimal", 0))
            return float(v or 0)
        deb = sum(_num(l.get("debit", 0)) for l in lines)
        cred = sum(_num(l.get("credit", 0)) for l in lines)
        assert round(deb - cred, 2) == 0, f"Unbalanced journal {jno}"

    def test_general_ledger(self, admin):
        r = admin.get(f"{BASE_URL}/api/accounts", timeout=15)
        assert r.status_code == 200
        accts = r.json()
        if isinstance(accts, dict):
            accts = accts.get("items", [])
        assert accts, "no accounts"
        code = accts[0].get("code")
        r2 = admin.get(f"{BASE_URL}/api/ledger?account_code={code}", timeout=15)
        assert r2.status_code == 200


# ---------- Fees ----------
class TestFees:
    def test_summary(self, finance):
        r = finance.get(f"{BASE_URL}/api/fees/summary", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "outstanding" in d and "total_students" in d

    def test_students_list(self, finance):
        r = finance.get(f"{BASE_URL}/api/fees/students?page=1&page_size=10", timeout=15)
        assert r.status_code == 200
        d = r.json()
        items = d.get("items", d) if isinstance(d, dict) else d
        assert items, "no student fee records"

    def test_record_payment_flow(self, finance):
        # find a student with outstanding
        r = finance.get(f"{BASE_URL}/api/fees/defaulters?page=1&page_size=5", timeout=15)
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert items, "no defaulters"
        student = items[0]
        roll = student["roll_no"]
        outstanding = float(student["outstanding"]) if not isinstance(student["outstanding"], dict) else float(student["outstanding"].get("$numberDecimal", 0))
        pay_amt = min(100.0, outstanding / 2) or 1.0
        key = f"TEST-{uuid.uuid4()}"
        r2 = finance.post(f"{BASE_URL}/api/fees/payments",
                          json={"roll_no": roll, "amount": pay_amt, "mode": "Online",
                                "idempotency_key": key}, timeout=20)
        assert r2.status_code == 200, r2.text
        assert "receipt_no" in r2.json()
        # Idempotency
        r3 = finance.post(f"{BASE_URL}/api/fees/payments",
                          json={"roll_no": roll, "amount": pay_amt, "mode": "Online",
                                "idempotency_key": key}, timeout=20)
        assert r3.status_code == 200 and r3.json().get("duplicate") is True

    def test_payment_exceeds_outstanding(self, finance):
        r = finance.get(f"{BASE_URL}/api/fees/defaulters?page=1&page_size=5", timeout=15)
        items = r.json().get("items", [])
        assert items
        student = items[0]
        roll = student["roll_no"]
        r2 = finance.post(f"{BASE_URL}/api/fees/payments",
                          json={"roll_no": roll, "amount": 99999999.99, "mode": "Online",
                                "idempotency_key": f"TEST-{uuid.uuid4()}"}, timeout=20)
        assert r2.status_code == 400, f"expected 400, got {r2.status_code}: {r2.text}"


# ---------- Procurement ----------
class TestProcurement:
    def test_invoices(self, admin):
        r = admin.get(f"{BASE_URL}/api/invoices", timeout=15)
        assert r.status_code == 200

    def test_invoice_match(self, admin):
        r = admin.get(f"{BASE_URL}/api/invoices", timeout=15)
        items = r.json().get("items", []) if isinstance(r.json(), dict) else r.json()
        if items:
            inv = items[0].get("invoice_no")
            r2 = admin.get(f"{BASE_URL}/api/invoices/{inv}/match", timeout=15)
            assert r2.status_code == 200

    def test_purchase_orders(self, admin):
        r = admin.get(f"{BASE_URL}/api/purchase-orders", timeout=15)
        assert r.status_code == 200

    def test_vendors(self, admin):
        r = admin.get(f"{BASE_URL}/api/vendors", timeout=15)
        assert r.status_code == 200

    def test_grns(self, admin):
        r = admin.get(f"{BASE_URL}/api/grn", timeout=15)
        assert r.status_code == 200


# ---------- Finance (revenue/exp/aging) ----------
class TestFinance:
    @pytest.mark.parametrize("path", [
        "/api/revenue", "/api/expenses",
        "/api/receivables/aging", "/api/payables/aging"])
    def test_finance_tabs(self, admin, path):
        r = admin.get(f"{BASE_URL}{path}", timeout=15)
        assert r.status_code == 200, f"{path}: {r.status_code} {r.text[:200]}"


# ---------- Budget ----------
class TestBudget:
    def test_budgets(self, admin):
        r = admin.get(f"{BASE_URL}/api/budgets", timeout=15)
        assert r.status_code == 200


# ---------- Audit ----------
class TestAudit:
    def test_audit_log(self, admin):
        r = admin.get(f"{BASE_URL}/api/audit/logs", timeout=15)
        assert r.status_code == 200

    def test_anomalies(self, admin):
        r = admin.get(f"{BASE_URL}/api/audit/anomalies", timeout=15)
        assert r.status_code == 200


# ---------- RBAC ----------
class TestRBAC:
    def test_auditor_forbidden_from_payments(self, auditor):
        r = auditor.post(f"{BASE_URL}/api/fees/payments",
                         json={"roll_no": "X", "amount": 1.0, "mode": "Online",
                               "idempotency_key": f"TEST-{uuid.uuid4()}"}, timeout=15)
        assert r.status_code == 403, f"auditor should get 403, got {r.status_code}"

    def test_procurement_can_view_procurement(self, procurement):
        r = procurement.get(f"{BASE_URL}/api/vendors", timeout=15)
        assert r.status_code == 200


# ---------- AI ----------
class TestAI:
    def test_suggestions(self, admin):
        r = admin.get(f"{BASE_URL}/api/ai/suggestions", timeout=15)
        assert r.status_code == 200
        assert len(r.json().get("suggestions", [])) > 0

    def test_ask(self, admin):
        r = admin.post(f"{BASE_URL}/api/ai/ask",
                       json={"question": "What is our outstanding student fee amount?",
                             "financial_year": "2025-26"}, timeout=90)
        assert r.status_code == 200, r.text
        ans = r.json().get("answer", "")
        assert ans and "—" not in ans, "em dash present in AI answer or empty"
