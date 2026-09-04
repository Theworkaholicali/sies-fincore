"""Student fees, payments, receipts, student ledger, fee analytics."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from core import db, clean, dec128, D, num, audit
from auth import require, get_current_user
from engine import post_journal, next_seq
from common import paginate

router = APIRouter(prefix="/api")


def _student_scope(user):
    if user["role"] == "student":
        return {"roll_no": user.get("roll_no", "__none__")}
    return {}


@router.get("/fees/students")
async def fee_students(page: int = 1, page_size: int = 25, q: str = "",
                       status: str = "", department: str = "",
                       user: dict = Depends(require("fees", "view"))):
    query = _student_scope(user)
    if status:
        query["status"] = status
    if department:
        query["department"] = department
    if q:
        query["$or"] = [{"student_name": {"$regex": q, "$options": "i"}},
                        {"roll_no": {"$regex": q, "$options": "i"}}]
    return await paginate("student_fees", query, page, page_size,
                          sort=[("outstanding", -1)])


@router.get("/fees/summary")
async def fee_summary(user: dict = Depends(require("fees", "view"))):
    assigned = paid = outstanding = concession = 0.0
    total = defaulters = 0
    async for f in db.student_fees.find(_student_scope(user)):
        assigned += num(f["assigned"]); paid += num(f["paid"])
        outstanding += num(f["outstanding"]); concession += num(f["concession"])
        total += 1
        if f["status"] == "unpaid":
            defaulters += 1
    net = assigned - concession
    return {"assigned": round(assigned, 2), "paid": round(paid, 2),
            "outstanding": round(outstanding, 2), "concession": round(concession, 2),
            "collection_rate": round(paid / net * 100, 1) if net else 0,
            "total_students": total, "defaulters": defaulters,
            "defaulter_rate": round(defaulters / total * 100, 1) if total else 0}


@router.get("/fees/by-department")
async def fee_by_department(user: dict = Depends(require("fees", "view"))):
    agg = {}
    async for f in db.student_fees.find():
        d = agg.setdefault(f["department"], {"paid": 0.0, "outstanding": 0.0, "count": 0})
        d["paid"] += num(f["paid"]); d["outstanding"] += num(f["outstanding"]); d["count"] += 1
    return [{"department": k, **{kk: round(vv, 2) if isinstance(vv, float) else vv
                                 for kk, vv in v.items()}} for k, v in agg.items()]


@router.get("/fees/defaulters")
async def defaulters(page: int = 1, page_size: int = 25,
                     user: dict = Depends(require("fees", "view"))):
    return await paginate("student_fees", {"status": {"$in": ["unpaid", "partial"]}},
                          page, page_size, sort=[("outstanding", -1)])


@router.get("/fees/student/{roll_no}")
async def student_detail(roll_no: str, user: dict = Depends(require("fees", "view"))):
    if user["role"] == "student" and user.get("roll_no") != roll_no:
        raise HTTPException(403, "You can only view your own fee record.")
    fee = await db.student_fees.find_one({"roll_no": roll_no})
    if not fee:
        raise HTTPException(404, "Student fee record not found.")
    ledger = await db.student_ledgers.find_one({"roll_no": roll_no})
    payments = await db.payments.find({"roll_no": roll_no}).sort("date", 1).to_list(50)
    return {"fee": clean(fee), "ledger": clean(ledger) if ledger else {"entries": []},
            "payments": [clean(p) for p in payments]}


class PaymentIn(BaseModel):
    roll_no: str
    amount: float
    mode: str = "Online"
    idempotency_key: str


@router.post("/fees/payments")
async def record_payment(body: PaymentIn,
                         user: dict = Depends(require("fees", "create"))):
    if body.amount <= 0:
        raise HTTPException(400, "Payment amount must be greater than zero.")
    existing = await db.payments.find_one({"idempotency_key": body.idempotency_key})
    if existing:
        return {"receipt_no": existing["receipt_no"], "duplicate": True,
                "message": "This payment was already recorded."}
    fee = await db.student_fees.find_one({"roll_no": body.roll_no})
    if not fee:
        raise HTTPException(404, "Student fee record not found.")
    outstanding = D(fee["outstanding"])
    amt = D(body.amount)
    if amt > outstanding:
        raise HTTPException(400,
            f"Payment cannot exceed the outstanding balance of {num(outstanding)}.")
    from datetime import datetime, timezone
    pdate = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    seq = await next_seq("receipt")
    rno = f"RCPT-{seq:06d}"
    debit_acct = "1000" if body.mode == "Cash" else "1020"
    await post_journal(f"Student fee collection {rno}",
                       [{"account_code": debit_acct, "debit": float(amt), "credit": 0},
                        {"account_code": "4000", "debit": 0, "credit": float(amt)}],
                       date=pdate, period=pdate[:7], fy=fee["academic_year"],
                       source="fee_payment", source_id=rno,
                       created_by=user["id"], created_by_name=user["name"])
    await db.payments.insert_one({
        "receipt_no": rno, "student_id": fee["student_id"], "roll_no": body.roll_no,
        "student_name": fee["student_name"], "amount": dec128(amt), "mode": body.mode,
        "date": pdate, "period": pdate[:7], "financial_year": fee["academic_year"],
        "status": "success", "idempotency_key": body.idempotency_key,
        "created_at": pdate})
    new_paid = D(fee["paid"]) + amt
    new_out = outstanding - amt
    await db.student_fees.update_one(
        {"roll_no": body.roll_no},
        {"$set": {"paid": dec128(new_paid), "outstanding": dec128(new_out),
                  "status": "paid" if new_out <= 0 else "partial"}})
    await db.student_ledgers.update_one(
        {"roll_no": body.roll_no},
        {"$push": {"entries": {"date": pdate, "description": f"Payment received ({rno})",
                               "debit": dec128(0), "credit": dec128(amt),
                               "balance": dec128(new_out), "ref": rno}}})
    await audit(user, "create", "payment", rno,
                f"Recorded fee payment of {num(amt)} for {body.roll_no}")
    return {"receipt_no": rno, "outstanding": num(new_out)}


@router.get("/payments")
async def payments(page: int = 1, page_size: int = 25, q: str = "",
                   user: dict = Depends(require("fees", "view"))):
    query = {}
    if q:
        query["$or"] = [{"receipt_no": {"$regex": q, "$options": "i"}},
                        {"student_name": {"$regex": q, "$options": "i"}},
                        {"roll_no": {"$regex": q, "$options": "i"}}]
    return await paginate("payments", query, page, page_size, sort=[("date", -1)])
