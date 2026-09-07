"""Financial period management: open, close, lock, reopen."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core import db, clean, now_iso, audit
from auth import require

router = APIRouter(prefix="/api")

VALID = {"open", "closed", "locked"}


@router.get("/financial-periods")
async def list_periods(fy: str = "", user: dict = Depends(require("accounting", "view"))):
    q = {"financial_year": fy} if fy else {}
    docs = await db.financial_periods.find(q).sort("code", 1).to_list(60)
    return [clean(d) for d in docs]


class StatusIn(BaseModel):
    status: str
    reason: str = ""


@router.post("/financial-periods/{code}/status")
async def set_status(code: str, body: StatusIn,
                     user: dict = Depends(require("accounting", "configure"))):
    if body.status not in VALID:
        raise HTTPException(400, "Invalid period status.")
    period = await db.financial_periods.find_one({"code": code})
    if not period:
        raise HTTPException(404, "Financial period not found.")
    prev = period.get("status", "open")

    # Reopening a locked or closed period requires a reason.
    if prev in ("closed", "locked") and body.status == "open" and not body.reason.strip():
        raise HTTPException(400, "Reopening a finalized period requires a documented reason.")
    # Locking should follow closing.
    if body.status == "locked" and prev == "open":
        raise HTTPException(400, "A period must be closed before it can be locked.")

    entry = {"from": prev, "to": body.status, "by": user["name"], "role": user["role"],
             "reason": body.reason, "at": now_iso()}
    await db.financial_periods.update_one(
        {"code": code},
        {"$set": {"status": body.status}, "$push": {"history": entry}})
    sev = "warning" if body.status == "open" and prev != "open" else "info"
    await audit(user, body.status, "financial_period", code,
                f"Period {code} changed from {prev} to {body.status}"
                + (f". Reason: {body.reason}" if body.reason else ""),
                before={"status": prev}, after={"status": body.status}, severity=sev)
    return {"code": code, "status": body.status}


@router.get("/financial-periods/{code}/history")
async def period_history(code: str, user: dict = Depends(require("accounting", "view"))):
    period = await db.financial_periods.find_one({"code": code})
    if not period:
        raise HTTPException(404, "Financial period not found.")
    return {"code": code, "history": clean(period).get("history", [])}
