"""Audit logs and rule-based anomaly detection."""
from fastapi import APIRouter, Depends
from core import db, clean, num, D
from auth import require
from common import paginate

router = APIRouter(prefix="/api")


@router.get("/audit/logs")
async def audit_logs(page: int = 1, page_size: int = 30, q: str = "",
                     user: dict = Depends(require("audit", "view"))):
    query = {}
    if q:
        query["$or"] = [{"action": {"$regex": q, "$options": "i"}},
                        {"entity": {"$regex": q, "$options": "i"}},
                        {"user_name": {"$regex": q, "$options": "i"}}]
    return await paginate("audit_logs", query, page, page_size,
                          sort=[("timestamp", -1)])


@router.get("/audit/anomalies")
async def anomalies(user: dict = Depends(require("audit", "view"))):
    flags = []
    # Duplicate invoices (same vendor + amount)
    seen = {}
    async for inv in db.invoices.find():
        key = (inv["vendor_name"], num(inv["amount"]))
        seen.setdefault(key, []).append(inv["invoice_no"])
    for (vendor, amt), invs in seen.items():
        if len(invs) > 1:
            flags.append({"type": "Possible duplicate invoice", "severity": "warning",
                          "detail": f"{vendor} has {len(invs)} invoices of the same amount ({amt}).",
                          "refs": invs, "status": "requires review"})
    # Large transactions
    async for j in db.journals.find({"total": {"$exists": True}}):
        if num(j["total"]) >= 3000000:
            flags.append({"type": "Large transaction", "severity": "info",
                          "detail": f"{j['journal_no']}: {j['narration']} for {num(j['total'])}.",
                          "refs": [j["journal_no"]], "status": "requires review"})
    # 3-way match exceptions
    async for inv in db.invoices.find({"three_way_match": "exception"}):
        flags.append({"type": "Three way match exception", "severity": "critical",
                      "detail": f"{inv['invoice_no']} from {inv['vendor_name']}: {inv.get('match_note', '')}",
                      "refs": [inv["invoice_no"]], "status": "requires review"})
    return flags[:60]
