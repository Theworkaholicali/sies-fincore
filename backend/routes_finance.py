"""Finance: revenue, expenses, budgets, department finance, cash, bank, grants, assets."""
from fastapi import APIRouter, Depends, HTTPException
from core import db, clean, num, D
from auth import require, get_current_user
from engine import account_balances, INCOME, EXPENSE
from common import paginate

router = APIRouter(prefix="/api")


@router.get("/revenue")
async def revenue(fy: str = "2025-26", user: dict = Depends(require("finance", "view"))):
    bal, accounts = await account_balances(fy)
    rows = []
    for code, acc in sorted(accounts.items()):
        if acc["type"] == INCOME and bal.get(code, 0) != 0:
            rows.append({"code": code, "name": acc["name"], "amount": round(bal[code], 2)})
    total = sum(r["amount"] for r in rows)
    for r in rows:
        r["share"] = round(r["amount"] / total * 100, 1) if total else 0
    rows.sort(key=lambda x: -x["amount"])
    return {"rows": rows, "total": round(total, 2)}


@router.get("/expenses")
async def expenses(fy: str = "2025-26", user: dict = Depends(require("finance", "view"))):
    bal, accounts = await account_balances(fy)
    rows = []
    for code, acc in sorted(accounts.items()):
        if acc["type"] == EXPENSE and bal.get(code, 0) != 0:
            rows.append({"code": code, "name": acc["name"], "amount": round(bal[code], 2)})
    total = sum(r["amount"] for r in rows)
    for r in rows:
        r["share"] = round(r["amount"] / total * 100, 1) if total else 0
    rows.sort(key=lambda x: -x["amount"])
    return {"rows": rows, "total": round(total, 2)}


@router.get("/budgets")
async def budgets(fy: str = "2025-26", user: dict = Depends(require("budget", "view"))):
    query = {"financial_year": fy}
    if user["role"] == "department_head":
        query["department"] = user.get("department", "__none__")
    docs = await db.budgets.find(query).sort("department", 1).to_list(100)
    rows = [clean(d) for d in docs]
    thresholds = {"monitor": 70, "warning": 85, "critical": 95}
    for r in rows:
        u = r.get("utilization", 0)
        if u >= 100:
            r["alert"] = "exceeded"
        elif u >= thresholds["critical"]:
            r["alert"] = "critical"
        elif u >= thresholds["warning"]:
            r["alert"] = "warning"
        elif u >= thresholds["monitor"]:
            r["alert"] = "monitor"
        else:
            r["alert"] = "normal"
    return {"rows": rows,
            "total_approved": round(sum(r["approved"] for r in rows), 2),
            "total_actual": round(sum(r["actual"] for r in rows), 2),
            "total_committed": round(sum(r["committed"] for r in rows), 2),
            "total_available": round(sum(r["available"] for r in rows), 2)}


@router.get("/department-finance")
async def department_finance(fy: str = "2025-26",
                             user: dict = Depends(require("finance", "view"))):
    result = []
    async for d in db.departments.find({"active": True}):
        code = d["code"]
        b = await db.budgets.find_one({"department": code, "financial_year": fy})
        exp = 0.0
        async for inv in db.invoices.find({"department": code}):
            exp += num(inv["amount"])
        po_count = await db.purchase_orders.count_documents({"department": code})
        result.append({
            "department": code, "department_name": d["name"],
            "approved": num(b["approved"]) if b else 0,
            "actual": num(b["actual"]) if b else round(exp, 2),
            "committed": num(b["committed"]) if b else 0,
            "available": num(b["available"]) if b else 0,
            "utilization": b.get("utilization", 0) if b else 0,
            "purchase_orders": po_count,
        })
    result.sort(key=lambda x: -x["utilization"])
    return result


@router.get("/grants")
async def grants(user: dict = Depends(require("grants", "view"))):
    docs = await db.grants.find().to_list(50)
    rows = [clean(d) for d in docs]
    for r in rows:
        r["utilization_pct"] = round(r["utilized"] / r["amount"] * 100, 1) if r["amount"] else 0
    return rows


@router.get("/assets")
async def assets(user: dict = Depends(require("assets", "view"))):
    docs = await db.assets.find().to_list(100)
    rows = [clean(d) for d in docs]
    return {"rows": rows,
            "total_cost": round(sum(r["cost"] for r in rows), 2),
            "total_book_value": round(sum(r["book_value"] for r in rows), 2)}
