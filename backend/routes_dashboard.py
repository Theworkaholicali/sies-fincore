"""Dashboard, analytics, KPI engine, notifications."""
from fastapi import APIRouter, Depends
from decimal import Decimal
from core import db, D, num, clean
from auth import require, get_current_user
from engine import financial_position, account_balances, INCOME, EXPENSE
from seed import MONTHS

router = APIRouter(prefix="/api")


async def _monthly_series(fy):
    accounts = {a["code"]: a async for a in db.accounts.find()}
    income = {m[0]: Decimal("0") for m in MONTHS}
    expense = {m[0]: Decimal("0") for m in MONTHS}
    inflow = {m[0]: Decimal("0") for m in MONTHS}
    outflow = {m[0]: Decimal("0") for m in MONTHS}
    async for j in db.journals.find({"financial_year": fy, "status": "posted"}):
        p = j.get("period", "")
        if p not in income:
            continue
        for ln in j["lines"]:
            acc = accounts.get(ln["account_code"])
            if not acc:
                continue
            dr, cr = D(ln["debit"]), D(ln["credit"])
            if acc["type"] == INCOME:
                income[p] += cr - dr
            elif acc["type"] == EXPENSE:
                expense[p] += dr - cr
            if acc["code"] in ("1000", "1010", "1020"):
                inflow[p] += dr
                outflow[p] += cr
    series = []
    for code, label in MONTHS:
        series.append({"period": label.split()[0][:3], "full": label,
                       "revenue": num(income[code]), "expense": num(expense[code]),
                       "inflow": num(inflow[code]), "outflow": num(outflow[code])})
    return series


@router.get("/dashboard")
async def dashboard(fy: str = "2025-26", user: dict = Depends(require("dashboard", "view"))):
    pos = await financial_position(fy)
    # fee data
    outstanding_fees = 0.0
    async for f in db.student_fees.find():
        outstanding_fees += num(f["outstanding"])
    # budget utilization
    budgets = await db.budgets.find({"financial_year": fy}).to_list(100)
    tot_app = sum(num(b["approved"]) for b in budgets)
    tot_act = sum(num(b["actual"]) for b in budgets)
    series = await _monthly_series(fy)
    # revenue composition
    bal, accounts = await account_balances(fy)
    rev_comp = sorted([{"name": accounts[c]["name"], "value": round(v, 2)}
                       for c, v in bal.items()
                       if accounts[c]["type"] == INCOME and v > 0],
                      key=lambda x: -x["value"])
    exp_comp = sorted([{"name": accounts[c]["name"], "value": round(v, 2)}
                       for c, v in bal.items()
                       if accounts[c]["type"] == EXPENSE and v > 0],
                      key=lambda x: -x["value"])[:8]
    # pending approvals / exceptions counts
    exceptions = await db.invoices.count_documents({"three_way_match": "exception"})
    dept_spending = []
    for b in sorted(budgets, key=lambda x: -num(x["actual"]))[:8]:
        dept_spending.append({"department": b["department_name"],
                              "actual": num(b["actual"]), "approved": num(b["approved"]),
                              "utilization": b.get("utilization", 0)})
    kpis = {
        "revenue": pos["revenue"], "expense": pos["expense"], "surplus": pos["surplus"],
        "cash": pos["cash"], "bank": pos["bank"], "receivable": round(outstanding_fees, 2),
        "payable": pos["payable"], "salary": pos["salary"], "capex": pos["capex"],
        "outstanding_fees": round(outstanding_fees, 2),
        "budget_utilization": round(tot_act / tot_app * 100, 1) if tot_app else 0,
        "budget_approved": round(tot_app, 2), "budget_actual": round(tot_act, 2),
    }
    return {"kpis": kpis, "monthly": series, "revenue_composition": rev_comp,
            "expense_composition": exp_comp, "department_spending": dept_spending,
            "exceptions": exceptions,
            "fee_collection": {"collected": round(pos["revenue"], 2),
                               "outstanding": round(outstanding_fees, 2)}}


@router.get("/analytics/kpis")
async def kpi_engine(fy: str = "2025-26", user: dict = Depends(require("analytics", "view"))):
    pos = await financial_position(fy)
    students = await db.students.count_documents({})
    rev = pos["revenue"] or 1
    kpis = [
        {"name": "Net Surplus Ratio", "value": round(pos["surplus"] / rev * 100, 1),
         "unit": "%", "desc": "Surplus as a share of total revenue",
         "warning": 5, "critical": 0, "higher_better": True},
        {"name": "Operating Ratio", "value": round(pos["expense"] / rev * 100, 1),
         "unit": "%", "desc": "Total expenditure against revenue",
         "warning": 90, "critical": 100, "higher_better": False},
        {"name": "Salary to Revenue", "value": round(pos["salary"] / rev * 100, 1),
         "unit": "%", "desc": "Payroll cost as a share of revenue",
         "warning": 55, "critical": 70, "higher_better": False},
        {"name": "Revenue per Student", "value": round(rev / students) if students else 0,
         "unit": "INR", "desc": "Average revenue generated per enrolled student",
         "higher_better": True},
        {"name": "Cost per Student", "value": round(pos["expense"] / students) if students else 0,
         "unit": "INR", "desc": "Average expenditure per enrolled student",
         "higher_better": False},
        {"name": "Cash Ratio", "value": round((pos["cash"] + pos["bank"]) / (pos["payable"] or 1), 2),
         "unit": "x", "desc": "Liquid funds against current payables",
         "warning": 1, "critical": 0.5, "higher_better": True},
    ]
    return {"kpis": kpis, "students": students}


@router.get("/analytics/forecast")
async def forecast(metric: str = "revenue", fy: str = "2025-26",
                   user: dict = Depends(require("analytics", "view"))):
    series = await _monthly_series(fy)
    values = [s[metric] for s in series if metric in s]
    # 3-month moving average projection for next 3 periods
    hist = [{"period": s["period"], "value": s.get(metric, 0), "type": "historical"}
            for s in series]
    window = values[-3:] if len(values) >= 3 else values
    proj_val = round(sum(window) / len(window), 2) if window else 0
    labels = ["Apr+", "May+", "Jun+"]
    trend = 1.0
    proj = []
    last = proj_val
    for lab in labels:
        last = round(last * 1.02, 2)
        proj.append({"period": lab, "value": last, "type": "projected"})
    return {"metric": metric, "method": "3-month moving average with trend",
            "historical": hist, "projected": proj}


@router.get("/notifications")
async def notifications(user: dict = Depends(get_current_user)):
    notes = []
    async for b in db.budgets.find({"utilization": {"$gte": 85}}):
        sev = "critical" if b["utilization"] >= 95 else "warning"
        notes.append({"severity": sev, "title": "Budget nearing limit",
                      "message": f"{b['department_name']} is at {b['utilization']}% budget utilization.",
                      "module": "budget"})
    exc = await db.invoices.count_documents({"three_way_match": "exception"})
    if exc:
        notes.append({"severity": "warning", "title": "Invoice match exceptions",
                      "message": f"{exc} invoices did not pass three way matching and need review.",
                      "module": "procurement"})
    defaulters = await db.student_fees.count_documents({"status": "unpaid"})
    if defaulters:
        notes.append({"severity": "info", "title": "Outstanding student fees",
                      "message": f"{defaulters} students have not paid any fee for the current year.",
                      "module": "fees"})
    return notes
