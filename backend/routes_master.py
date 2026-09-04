"""Master data + accounting routes."""
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from typing import List
from core import db, clean, dec128, D, num
from auth import require, get_current_user
from engine import trial_balance, account_balances, post_journal, UnbalancedJournal, ASSET, LIABILITY, EQUITY, INCOME, EXPENSE, DEBIT_NORMAL
from common import paginate

router = APIRouter(prefix="/api")


@router.get("/master/context")
async def context(user: dict = Depends(get_current_user)):
    fys = [clean(d) for d in await db.financial_years.find().sort("code", 1).to_list(50)]
    periods = [clean(d) for d in await db.financial_periods.find().sort("code", 1).to_list(50)]
    depts = [clean(d) for d in await db.departments.find({"active": True}).sort("name", 1).to_list(50)]
    ays = [clean(d) for d in await db.academic_years.find().to_list(50)]
    return {"financial_years": fys, "periods": periods, "departments": depts,
            "academic_years": ays}


@router.get("/departments")
async def departments(user: dict = Depends(get_current_user)):
    return [clean(d) for d in await db.departments.find().sort("name", 1).to_list(100)]


@router.get("/programs")
async def programs(user: dict = Depends(get_current_user)):
    return [clean(d) for d in await db.programs.find().to_list(100)]


@router.get("/users")
async def users(user: dict = Depends(require("administration", "view"))):
    docs = await db.users.find({}, {"password_hash": 0}).to_list(200)
    return [clean(d) for d in docs]


# ---------------- Accounting ----------------
@router.get("/accounts")
async def accounts(user: dict = Depends(require("accounting", "view"))):
    docs = await db.accounts.find().sort("code", 1).to_list(200)
    return [clean(d) for d in docs]


@router.get("/journals")
async def journals(page: int = 1, page_size: int = 25, q: str = "",
                   source: str = "", fy: str = "2025-26",
                   user: dict = Depends(require("accounting", "view"))):
    query = {"financial_year": fy}
    if source:
        query["source"] = source
    if q:
        query["$or"] = [{"journal_no": {"$regex": q, "$options": "i"}},
                        {"narration": {"$regex": q, "$options": "i"}}]
    return await paginate("journals", query, page, page_size, sort=[("journal_no", -1)])


@router.get("/journals/{journal_no}")
async def journal_detail(journal_no: str,
                         user: dict = Depends(require("accounting", "view"))):
    doc = await db.journals.find_one({"journal_no": journal_no})
    if not doc:
        raise HTTPException(404, "Journal entry not found.")
    return clean(doc)


class JournalLineIn(BaseModel):
    account_code: str
    debit: float = 0
    credit: float = 0
    description: str = ""


class JournalIn(BaseModel):
    narration: str
    date: str
    period: str = ""
    financial_year: str = "2025-26"
    lines: List[JournalLineIn]


@router.post("/journals")
async def create_journal(body: JournalIn,
                         user: dict = Depends(require("accounting", "create"))):
    fy = await db.financial_years.find_one({"code": body.financial_year})
    if fy and fy.get("status") == "closed":
        raise HTTPException(400, "This financial year is closed and cannot accept new entries.")
    try:
        jno, _id = await post_journal(
            body.narration, [l.model_dump() for l in body.lines], date=body.date,
            period=body.period, fy=body.financial_year, source="manual",
            created_by=user["id"], created_by_name=user["name"])
    except UnbalancedJournal as e:
        raise HTTPException(400, str(e))
    from core import audit
    await audit(user, "create", "journal", jno, f"Posted journal {jno}")
    return {"journal_no": jno}


@router.get("/ledger")
async def ledger(account_code: str = Query(...), fy: str = "2025-26",
                 user: dict = Depends(require("accounting", "view"))):
    acc = await db.accounts.find_one({"code": account_code})
    if not acc:
        raise HTTPException(404, "Account not found.")
    entries = []
    running = D(0)
    debit_normal = acc["type"] in DEBIT_NORMAL
    cursor = db.journals.find({"financial_year": fy, "status": "posted"}).sort("journal_no", 1)
    async for j in cursor:
        for ln in j["lines"]:
            if ln["account_code"] != account_code:
                continue
            dr = D(ln["debit"])
            cr = D(ln["credit"])
            running += (dr - cr) if debit_normal else (cr - dr)
            entries.append({
                "date": j["date"][:10], "journal_no": j["journal_no"],
                "narration": j["narration"], "debit": num(dr), "credit": num(cr),
                "balance": num(running), "source": j["source"],
            })
    return {"account": clean(acc), "entries": entries, "closing": num(running)}


@router.get("/trial-balance")
async def trial_balance_route(fy: str = "2025-26",
                              user: dict = Depends(require("accounting", "view"))):
    return await trial_balance(fy)


@router.get("/financial-statements")
async def statements(fy: str = "2025-26",
                     user: dict = Depends(require("accounting", "view"))):
    bal, accounts = await account_balances(fy)
    income, expense, assets, liabilities, equity = [], [], [], [], []
    tot_income = tot_expense = tot_assets = tot_liab = tot_equity = 0.0
    for code, acc in sorted(accounts.items()):
        v = bal.get(code, 0.0)
        row = {"code": code, "name": acc["name"], "amount": round(v, 2)}
        if acc["type"] == INCOME:
            income.append(row); tot_income += v
        elif acc["type"] == EXPENSE:
            expense.append(row); tot_expense += v
        elif acc["type"] == ASSET:
            assets.append(row); tot_assets += v
        elif acc["type"] == LIABILITY:
            liabilities.append(row); tot_liab += v
        elif acc["type"] == EQUITY:
            equity.append(row); tot_equity += v
    surplus = tot_income - tot_expense
    return {
        "financial_year": fy,
        "income_expenditure": {
            "income": [r for r in income if r["amount"] != 0],
            "expense": [r for r in expense if r["amount"] != 0],
            "total_income": round(tot_income, 2),
            "total_expense": round(tot_expense, 2),
            "surplus": round(surplus, 2),
        },
        "balance_sheet": {
            "assets": [r for r in assets if r["amount"] != 0],
            "liabilities": [r for r in liabilities if r["amount"] != 0],
            "equity": [r for r in equity if r["amount"] != 0],
            "total_assets": round(tot_assets, 2),
            "total_liabilities": round(tot_liab, 2),
            "total_equity": round(tot_equity + surplus, 2),
            "surplus_to_fund": round(surplus, 2),
        },
    }
