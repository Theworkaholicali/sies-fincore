"""Accounting engine (double-entry) and central financial engine."""
from decimal import Decimal
from datetime import datetime, timezone
from core import db, D, dec128, num, now_iso

# Account types and normal balances
ASSET, LIABILITY, EQUITY, INCOME, EXPENSE = "ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"
DEBIT_NORMAL = {ASSET, EXPENSE}


class UnbalancedJournal(Exception):
    pass


class PeriodLocked(Exception):
    pass


async def ensure_period_open(period_code):
    """Reject postings into a closed or locked financial period."""
    if not period_code:
        return
    p = await db.financial_periods.find_one({"code": period_code})
    if p and p.get("status") in ("closed", "locked"):
        raise PeriodLocked(
            f"Financial period {p.get('label', period_code)} is {p['status']} "
            f"and cannot accept new postings.")


async def next_seq(name: str) -> int:
    doc = await db.counters.find_one_and_update(
        {"_id": name}, {"$inc": {"value": 1}}, upsert=True, return_document=True)
    return doc["value"]


async def post_journal(narration, lines, date=None, period=None, fy=None,
                       source="manual", source_id="", created_by="system",
                       created_by_name="System"):
    """lines: [{account_code, debit, credit, description}]. Rejects unbalanced."""
    await ensure_period_open(period)
    total_debit = Decimal("0")
    total_credit = Decimal("0")
    norm_lines = []
    for ln in lines:
        dr = D(ln.get("debit", 0))
        cr = D(ln.get("credit", 0))
        total_debit += dr
        total_credit += cr
        norm_lines.append({
            "account_code": ln["account_code"],
            "account_name": ln.get("account_name", ""),
            "debit": dec128(dr),
            "credit": dec128(cr),
            "description": ln.get("description", ""),
        })
    if total_debit != total_credit:
        raise UnbalancedJournal(
            f"Journal not balanced: debits {total_debit} vs credits {total_credit}")
    if total_debit == 0:
        raise UnbalancedJournal("Journal has no monetary lines")
    seq = await next_seq("journal")
    jno = f"JV-{seq:06d}"
    # attach account names
    for ln in norm_lines:
        acc = await db.accounts.find_one({"code": ln["account_code"]})
        ln["account_name"] = acc["name"] if acc else ln["account_code"]
    doc = {
        "journal_no": jno,
        "date": date or now_iso(),
        "narration": narration,
        "lines": norm_lines,
        "total": dec128(total_debit),
        "source": source,
        "source_id": str(source_id),
        "financial_year": fy or "2025-26",
        "period": period or "",
        "status": "posted",
        "created_by": str(created_by),
        "created_by_name": created_by_name,
        "created_at": now_iso(),
    }
    res = await db.journals.insert_one(doc)
    return jno, str(res.inserted_id)


async def account_map():
    return {a["code"]: a async for a in db.accounts.find({})}


async def trial_balance(fy=None):
    """Aggregate posted journal lines per account."""
    accounts = await account_map()
    totals = {}  # code -> [debit, credit]
    q = {"status": "posted"}
    if fy:
        q["financial_year"] = fy
    async for j in db.journals.find(q):
        for ln in j["lines"]:
            code = ln["account_code"]
            d = totals.setdefault(code, [Decimal("0"), Decimal("0")])
            d[0] += D(ln["debit"])
            d[1] += D(ln["credit"])
    rows = []
    tot_d = Decimal("0")
    tot_c = Decimal("0")
    for code, acc in sorted(accounts.items()):
        d, c = totals.get(code, [Decimal("0"), Decimal("0")])
        if acc["type"] in DEBIT_NORMAL:
            bal = d - c
            debit_bal = bal if bal >= 0 else Decimal("0")
            credit_bal = -bal if bal < 0 else Decimal("0")
        else:
            bal = c - d
            credit_bal = bal if bal >= 0 else Decimal("0")
            debit_bal = -bal if bal < 0 else Decimal("0")
        tot_d += debit_bal
        tot_c += credit_bal
        if d == 0 and c == 0:
            continue
        rows.append({
            "code": code, "name": acc["name"], "type": acc["type"],
            "debit": num(debit_bal), "credit": num(credit_bal),
        })
    return {"rows": rows, "total_debit": num(tot_d), "total_credit": num(tot_c),
            "balanced": tot_d == tot_c}


async def account_balances(fy=None):
    """Return net balance per account code (signed by normal balance)."""
    tb = await trial_balance(fy)
    accounts = await account_map()
    bal = {}
    for r in tb["rows"]:
        acc = accounts[r["code"]]
        if acc["type"] in DEBIT_NORMAL:
            bal[r["code"]] = r["debit"] - r["credit"]
        else:
            bal[r["code"]] = r["credit"] - r["debit"]
    return bal, accounts


async def financial_position(fy=None):
    """Central financial engine: single source of truth for headline numbers."""
    bal, accounts = await account_balances(fy)
    revenue = sum(v for c, v in bal.items() if accounts[c]["type"] == INCOME)
    expense = sum(v for c, v in bal.items() if accounts[c]["type"] == EXPENSE)
    cash = bal.get("1000", 0.0)
    bank = bal.get("1010", 0.0) + bal.get("1020", 0.0)
    receivable = bal.get("1100", 0.0)
    payable = bal.get("2000", 0.0)
    salary = bal.get("5000", 0.0) + bal.get("5010", 0.0)
    capex = bal.get("1200", 0.0)
    return {
        "revenue": round(revenue, 2),
        "expense": round(expense, 2),
        "surplus": round(revenue - expense, 2),
        "cash": round(cash, 2),
        "bank": round(bank, 2),
        "receivable": round(receivable, 2),
        "payable": round(payable, 2),
        "salary": round(salary, 2),
        "capex": round(capex, 2),
    }
