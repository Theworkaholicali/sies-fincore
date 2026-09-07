"""Bank management and reconciliation."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from typing import List, Optional
from datetime import datetime
from core import db, clean, num, D, dec128, now_iso, audit
from auth import require

router = APIRouter(prefix="/api")


@router.get("/bank/accounts")
async def bank_accounts(user: dict = Depends(require("finance", "view"))):
    docs = await db.bank_accounts.find({}).to_list(50)
    return [clean(d) for d in docs]


async def _internal_transactions(gl_account, fy="2025-26"):
    """Bank transactions from the general ledger for a bank GL account."""
    txns = []
    async for j in db.journals.find({"financial_year": fy, "status": "posted"}).sort("journal_no", 1):
        for ln in j["lines"]:
            if ln["account_code"] != gl_account:
                continue
            dr, cr = num(ln["debit"]), num(ln["credit"])
            if dr == 0 and cr == 0:
                continue
            txns.append({
                "journal_no": j["journal_no"], "date": j["date"][:10],
                "narration": j["narration"],
                "amount": dr if dr else cr,
                "direction": "in" if dr else "out",  # bank debit = money in
            })
    return txns


def _parse_csv(csv_text):
    lines = []
    for raw in csv_text.strip().splitlines():
        parts = [p.strip() for p in raw.split(",")]
        if len(parts) < 4:
            continue
        if parts[0].lower() in ("date", "txn date"):
            continue
        try:
            amount = float(parts[3])
        except ValueError:
            continue
        lines.append({"date": parts[0], "description": parts[1],
                      "reference": parts[2], "amount": abs(amount),
                      "direction": "in" if amount >= 0 else "out"})
    return lines


class ImportIn(BaseModel):
    account_code: str
    csv: Optional[str] = None
    lines: Optional[List[dict]] = None


@router.post("/bank/statements/import")
async def import_statement(body: ImportIn, user: dict = Depends(require("finance", "reconcile"))):
    acc = await db.bank_accounts.find_one({"code": body.account_code})
    if not acc:
        raise HTTPException(404, "Bank account not found.")
    rows = body.lines if body.lines else (_parse_csv(body.csv) if body.csv else [])
    if not rows:
        raise HTTPException(400, "No valid statement lines were found to import.")
    inserted = 0
    for r in rows:
        if r.get("amount", 0) <= 0 or not r.get("date"):
            continue
        await db.bank_statement_lines.insert_one({
            "account_code": body.account_code, "date": r["date"],
            "description": r.get("description", ""), "reference": r.get("reference", ""),
            "amount": dec128(r["amount"]), "direction": r.get("direction", "in"),
            "status": "unmatched", "matched_journal": "",
            "imported_by": user["name"], "created_at": now_iso()})
        inserted += 1
    await audit(user, "import", "bank_statement", body.account_code,
                f"Imported {inserted} statement lines for {acc['name']}")
    return {"imported": inserted}


@router.post("/bank/statements/sample")
async def load_sample(body: dict, user: dict = Depends(require("finance", "reconcile"))):
    """Seed a realistic sample statement derived from the ledger plus a few extras."""
    code = body.get("account_code")
    acc = await db.bank_accounts.find_one({"code": code})
    if not acc:
        raise HTTPException(404, "Bank account not found.")
    await db.bank_statement_lines.delete_many({"account_code": code})
    txns = await _internal_transactions(acc["gl_account"])
    sample = txns[:14]
    inserted = 0
    for t in sample:
        await db.bank_statement_lines.insert_one({
            "account_code": code, "date": t["date"],
            "description": t["narration"][:60], "reference": t["journal_no"],
            "amount": dec128(t["amount"]), "direction": t["direction"],
            "status": "unmatched", "matched_journal": "",
            "imported_by": user["name"], "created_at": now_iso()})
        inserted += 1
    # unmatched extras that exist only on the bank statement
    for extra in [("Bank service charges", "BNKCHG", 4500, "out"),
                  ("Savings interest credit", "INT", 18200, "in")]:
        await db.bank_statement_lines.insert_one({
            "account_code": code, "date": "2026-03-28", "description": extra[0],
            "reference": extra[1], "amount": dec128(extra[2]), "direction": extra[3],
            "status": "unmatched", "matched_journal": "",
            "imported_by": user["name"], "created_at": now_iso()})
        inserted += 1
    return {"imported": inserted}


@router.post("/bank/reconcile/auto")
async def auto_reconcile(body: dict, user: dict = Depends(require("finance", "reconcile"))):
    code = body.get("account_code")
    acc = await db.bank_accounts.find_one({"code": code})
    if not acc:
        raise HTTPException(404, "Bank account not found.")
    txns = await _internal_transactions(acc["gl_account"])
    used = set()
    matched = 0
    async for line in db.bank_statement_lines.find({"account_code": code, "status": "unmatched"}):
        amt = num(line["amount"])
        for i, t in enumerate(txns):
            if i in used:
                continue
            # match on exact amount, direction and reference or close date
            ref_ok = t["journal_no"] == line.get("reference")
            date_ok = abs(_daydiff(t["date"], line["date"])) <= 5
            if t["amount"] == amt and t["direction"] == line["direction"] and (ref_ok or date_ok):
                used.add(i)
                await db.bank_statement_lines.update_one(
                    {"_id": line["_id"]},
                    {"$set": {"status": "matched", "matched_journal": t["journal_no"]}})
                matched += 1
                break
    await audit(user, "reconcile", "bank_statement", code,
                f"Auto matched {matched} statement lines for {acc['name']}")
    return {"matched": matched}


def _daydiff(a, b):
    try:
        return (datetime.fromisoformat(a[:10]) - datetime.fromisoformat(b[:10])).days
    except Exception:
        return 999


class MatchIn(BaseModel):
    line_id: str
    journal_no: str


@router.post("/bank/match")
async def manual_match(body: MatchIn, user: dict = Depends(require("finance", "reconcile"))):
    line = await db.bank_statement_lines.find_one({"_id": ObjectId(body.line_id)})
    if not line:
        raise HTTPException(404, "Statement line not found.")
    j = await db.journals.find_one({"journal_no": body.journal_no})
    if not j:
        raise HTTPException(400, "Referenced journal entry does not exist.")
    await db.bank_statement_lines.update_one(
        {"_id": ObjectId(body.line_id)},
        {"$set": {"status": "manual", "matched_journal": body.journal_no}})
    await audit(user, "reconcile", "bank_statement_line", body.line_id,
                f"Manually matched statement line to {body.journal_no}")
    return {"ok": True}


@router.get("/bank/reconciliation/{code}")
async def reconciliation(code: str, user: dict = Depends(require("finance", "view"))):
    acc = await db.bank_accounts.find_one({"code": code})
    if not acc:
        raise HTTPException(404, "Bank account not found.")
    lines = await db.bank_statement_lines.find({"account_code": code}).sort("date", 1).to_list(500)
    rows = [clean(l) for l in lines]
    matched = [r for r in rows if r["status"] in ("matched", "manual")]
    unmatched = [r for r in rows if r["status"] == "unmatched"]
    from engine import account_balances
    bal, _ = await account_balances("2025-26")
    book = round(bal.get(acc["gl_account"], 0.0), 2)
    matched_net = sum((r["amount"] if r["direction"] == "in" else -r["amount"]) for r in matched)
    return {
        "account": clean(acc),
        "book_balance": book,
        "statement_lines": rows,
        "matched_count": len(matched), "unmatched_count": len(unmatched),
        "matched_net": round(matched_net, 2),
        "reconciled": len(unmatched) == 0 and len(rows) > 0,
    }
