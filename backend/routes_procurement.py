"""Procurement: vendors, purchase orders, GRN, invoices, 3-way match, AP/AR."""
from fastapi import APIRouter, Depends, HTTPException
from core import db, clean, num, D
from auth import require
from common import paginate

router = APIRouter(prefix="/api")


@router.get("/vendors")
async def vendors(page: int = 1, page_size: int = 25, q: str = "",
                  user: dict = Depends(require("procurement", "view"))):
    query = {}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}},
                        {"vendor_code": {"$regex": q, "$options": "i"}}]
    return await paginate("vendors", query, page, page_size, sort=[("name", 1)])


@router.get("/vendors/{vendor_code}/ledger")
async def vendor_ledger(vendor_code: str,
                        user: dict = Depends(require("procurement", "view"))):
    v = await db.vendors.find_one({"vendor_code": vendor_code})
    if not v:
        raise HTTPException(404, "Vendor not found.")
    entries = []
    balance = D(0)
    async for inv in db.invoices.find({"vendor_id": str(v["_id"])}).sort("date", 1):
        balance += D(inv["amount"])
        entries.append({"date": inv["date"], "ref": inv["invoice_no"],
                        "description": "Invoice raised", "debit": 0,
                        "credit": num(inv["amount"]), "balance": num(balance)})
        pay = await db.vendor_payments.find_one({"invoice_no": inv["invoice_no"]})
        if pay:
            balance -= D(pay["amount"])
            entries.append({"date": pay["date"], "ref": pay["payment_no"],
                            "description": "Payment made", "debit": num(pay["amount"]),
                            "credit": 0, "balance": num(balance)})
    return {"vendor": clean(v), "entries": entries, "outstanding": num(balance)}


@router.get("/purchase-orders")
async def purchase_orders(page: int = 1, page_size: int = 25, q: str = "",
                          department: str = "",
                          user: dict = Depends(require("procurement", "view"))):
    query = {}
    if department:
        query["department"] = department
    if q:
        query["$or"] = [{"po_no": {"$regex": q, "$options": "i"}},
                        {"vendor_name": {"$regex": q, "$options": "i"}}]
    return await paginate("purchase_orders", query, page, page_size, sort=[("po_no", -1)])


@router.get("/grn")
async def grn(page: int = 1, page_size: int = 25,
              user: dict = Depends(require("procurement", "view"))):
    return await paginate("goods_receipts", {}, page, page_size, sort=[("grn_no", -1)])


@router.get("/invoices")
async def invoices(page: int = 1, page_size: int = 25, q: str = "", match: str = "",
                   user: dict = Depends(require("procurement", "view"))):
    query = {}
    if match:
        query["three_way_match"] = match
    if q:
        query["$or"] = [{"invoice_no": {"$regex": q, "$options": "i"}},
                        {"vendor_name": {"$regex": q, "$options": "i"}},
                        {"po_no": {"$regex": q, "$options": "i"}}]
    return await paginate("invoices", query, page, page_size, sort=[("invoice_no", -1)])


@router.get("/invoices/{invoice_no}/match")
async def three_way_match(invoice_no: str,
                          user: dict = Depends(require("procurement", "view"))):
    inv = await db.invoices.find_one({"invoice_no": invoice_no})
    if not inv:
        raise HTTPException(404, "Invoice not found.")
    po = await db.purchase_orders.find_one({"po_no": inv["po_no"]})
    grn_doc = await db.goods_receipts.find_one({"grn_no": inv["grn_no"]})
    checks = []
    if po and grn_doc:
        checks = [
            {"factor": "Vendor", "po": po["vendor_name"], "grn": grn_doc["vendor_name"],
             "invoice": inv["vendor_name"],
             "ok": po["vendor_name"] == inv["vendor_name"]},
            {"factor": "Quantity", "po": po["quantity"], "grn": grn_doc["received_qty"],
             "invoice": grn_doc["received_qty"],
             "ok": po["quantity"] == grn_doc["received_qty"]},
            {"factor": "Amount", "po": num(po["amount"]), "grn": "-",
             "invoice": num(inv["amount"]),
             "ok": po["quantity"] == grn_doc["received_qty"]},
        ]
    return {"invoice": clean(inv), "po": clean(po) if po else None,
            "grn": clean(grn_doc) if grn_doc else None, "checks": checks,
            "result": inv["three_way_match"], "note": inv.get("match_note", "")}


@router.get("/payables/aging")
async def payables_aging(user: dict = Depends(require("procurement", "view"))):
    from datetime import datetime, timezone
    buckets = {"0-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
    today = datetime.now(timezone.utc)
    rows = []
    async for inv in db.invoices.find({"status": {"$ne": "paid"}}):
        try:
            d = datetime.fromisoformat(inv["date"]).replace(tzinfo=timezone.utc)
            days = (today - d).days
        except Exception:
            days = 30
        b = "0-30" if days <= 30 else "31-60" if days <= 60 else "61-90" if days <= 90 else "90+"
        buckets[b] += num(inv["amount"])
        rows.append({"invoice_no": inv["invoice_no"], "vendor": inv["vendor_name"],
                     "amount": num(inv["amount"]), "days": days, "bucket": b,
                     "status": inv["status"]})
    return {"buckets": {k: round(v, 2) for k, v in buckets.items()}, "rows": rows,
            "total": round(sum(buckets.values()), 2)}


@router.get("/receivables/aging")
async def receivables_aging(user: dict = Depends(require("finance", "view"))):
    buckets = {"current": 0.0, "overdue": 0.0}
    rows = []
    async for f in db.student_fees.find({"outstanding": {"$gt": 0}}):
        out = num(f["outstanding"])
        overdue = f["status"] in ("unpaid", "partial")
        buckets["overdue" if overdue else "current"] += out
        rows.append({"roll_no": f["roll_no"], "student": f["student_name"],
                     "department": f["department"], "amount": out, "status": f["status"]})
    rows.sort(key=lambda x: -x["amount"])
    return {"buckets": {k: round(v, 2) for k, v in buckets.items()},
            "rows": rows[:100], "total": round(sum(buckets.values()), 2)}
