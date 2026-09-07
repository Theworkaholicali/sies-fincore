"""Second-phase seed: approval rules/requests, bank account + statement, period status."""
from core import db, dec128, now_iso, D, num
from engine import next_seq
import approval_engine as ae

FLAG = "seeded_v2"


async def already():
    return await db.system_flags.find_one({"_id": FLAG}) is not None


async def seed_v2():
    if await already():
        return
    await _rules()
    await _requests()
    await _bank()
    await _periods()
    await db.system_flags.insert_one({"_id": FLAG, "at": now_iso()})


async def _rules():
    rules = [
        ("purchase_order", "*", 0, 100000, ["department_head"]),
        ("purchase_order", "*", 100000, 500000, ["department_head", "finance_manager"]),
        ("purchase_order", "*", 500000, None, ["finance_manager", "management"]),
        ("invoice", "*", 0, 200000, ["finance_manager"]),
        ("invoice", "*", 200000, None, ["finance_manager", "principal"]),
        ("payment", "*", 0, 50000, ["finance_manager"]),
        ("payment", "*", 50000, 300000, ["finance_manager", "principal"]),
        ("payment", "*", 300000, None, ["finance_manager", "management"]),
        ("expense", "*", 0, 50000, ["department_head", "finance_manager"]),
        ("expense", "*", 50000, None, ["finance_manager", "principal"]),
    ]
    for dt, dept, lo, hi, steps in rules:
        await db.approval_rules.insert_one({
            "doc_type": dt, "department": dept, "min_amount": dec128(lo),
            "max_amount": dec128(hi) if hi is not None else None,
            "steps": steps, "active": True, "created_at": now_iso()})


class _Sys:
    def get(self, k, d=None):
        return {"id": "", "name": "System", "role": "system"}.get(k, d)


async def _requests():
    sysu = {"id": "", "name": "Procurement Office", "role": "procurement_officer"}
    # link a couple of on-hold invoices (3-way exceptions) into approvals
    count = 0
    async for inv in db.invoices.find({"three_way_match": "exception"}).limit(3):
        await ae.create_approval(
            "invoice", inv["invoice_no"], inv["department"], num(inv["amount"]),
            f"Invoice {inv['invoice_no']} from {inv['vendor_name']} held on 3-way match exception",
            sysu, expense_account=inv.get("expense_account"), payee=inv["vendor_name"],
            period=inv.get("period", "2025-26"), fy="2025-26")
        count += 1
    # a few fresh expense/payment requests awaiting approval
    fresh = [
        ("expense", "CS", 42000, "5300", "Annual printing and stationery for CS department", "Bright Stationers"),
        ("payment", "BIO", 185000, "5200", "Laboratory reagents replenishment", "Global Lab Supplies"),
        ("payment", "PHY", 640000, "5130", "Solar panel maintenance contract renewal", "Cool Air Systems"),
        ("expense", "COM", 28000, "5400", "Commerce department seminar expenses", "Nerul Printers"),
    ]
    for dt, dept, amt, acct, desc, payee in fresh:
        await ae.create_approval(dt, "", dept, amt, desc, sysu,
                                 expense_account=acct, payee=payee,
                                 period="2026-03", fy="2025-26")


async def _bank():
    if await db.bank_accounts.find_one({"code": "SBI-OP"}):
        return
    await db.bank_accounts.insert_one({
        "code": "SBI-OP", "name": "State Bank of India - Operating Account",
        "gl_account": "1010", "account_number": "XXXXXX4821",
        "ifsc": "SBIN0001234", "branch": "Nerul", "created_at": now_iso()})
    await db.bank_accounts.insert_one({
        "code": "HDFC-FEE", "name": "HDFC Bank - Fee Collection Account",
        "gl_account": "1020", "account_number": "XXXXXX7710",
        "ifsc": "HDFC0000567", "branch": "Nerul", "created_at": now_iso()})


async def _periods():
    # Demonstrate variety without blocking current-year live postings elsewhere.
    await db.financial_periods.update_one(
        {"code": "2025-04"},
        {"$set": {"status": "locked"},
         "$push": {"history": {"from": "open", "to": "closed", "by": "Mr. Anil Kulkarni",
                               "role": "finance_manager", "reason": "Year opening finalized",
                               "at": now_iso()}}})
    await db.financial_periods.update_one(
        {"code": "2025-05"},
        {"$set": {"status": "closed"},
         "$push": {"history": {"from": "open", "to": "closed", "by": "Mr. Anil Kulkarni",
                               "role": "finance_manager", "reason": "Monthly close completed",
                               "at": now_iso()}}})
