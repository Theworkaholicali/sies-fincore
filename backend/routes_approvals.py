"""Approval workflow routes."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from typing import List, Optional
from core import db, clean, num, D, dec128, now_iso
from auth import require, get_current_user
from engine import PeriodLocked
import approval_engine as ae
from common import paginate

router = APIRouter(prefix="/api")


@router.get("/approval-rules")
async def list_rules(user: dict = Depends(require("approvals", "view"))):
    docs = await db.approval_rules.find({}).sort([("doc_type", 1), ("min_amount", 1)]).to_list(200)
    return [clean(d) for d in docs]


class RuleIn(BaseModel):
    doc_type: str
    department: str = "*"
    min_amount: float = 0
    max_amount: Optional[float] = None
    steps: List[str]
    active: bool = True


@router.post("/approval-rules")
async def create_rule(body: RuleIn, user: dict = Depends(require("approvals", "configure"))):
    if body.doc_type not in ae.DOC_TYPES:
        raise HTTPException(400, "Unsupported document type for approval rule.")
    if not body.steps:
        raise HTTPException(400, "An approval rule needs at least one approver step.")
    doc = body.model_dump()
    doc["min_amount"] = dec128(doc["min_amount"])
    doc["max_amount"] = dec128(doc["max_amount"]) if doc["max_amount"] is not None else None
    doc["created_at"] = now_iso()
    res = await db.approval_rules.insert_one(doc)
    from core import audit
    await audit(user, "configure", "approval_rule", str(res.inserted_id),
                f"Created approval rule for {body.doc_type}")
    return {"id": str(res.inserted_id)}


@router.delete("/approval-rules/{rule_id}")
async def delete_rule(rule_id: str, user: dict = Depends(require("approvals", "configure"))):
    await db.approval_rules.update_one({"_id": ObjectId(rule_id)}, {"$set": {"active": False}})
    return {"ok": True}


class RequestIn(BaseModel):
    doc_type: str
    reference: str = ""
    department: str
    amount: float
    description: str
    expense_account: Optional[str] = None
    payee: Optional[str] = None
    period: str = "2025-26"
    financial_year: str = "2025-26"


@router.post("/approvals")
async def raise_approval(body: RequestIn, user: dict = Depends(require("approvals", "create"))):
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be greater than zero.")
    rno, _ = await ae.create_approval(
        body.doc_type, body.reference, body.department, body.amount, body.description,
        user, expense_account=body.expense_account, payee=body.payee,
        period=body.period, fy=body.financial_year)
    return {"request_no": rno}


@router.get("/approvals")
async def list_approvals(page: int = 1, page_size: int = 25, status: str = "",
                         doc_type: str = "", mine: bool = False,
                         user: dict = Depends(require("approvals", "view"))):
    query = {}
    if status:
        query["status"] = status
    if doc_type:
        query["doc_type"] = doc_type
    data = await paginate("approvals", query, page, page_size, sort=[("request_no", -1)])
    # annotate whether current user can act on the current step
    for a in data["items"]:
        step = a["steps"][a["current_step"]] if a["status"] == "pending" and a["steps"] else None
        a["can_act"] = bool(step and (user["role"] == step["role"] or user["role"] == "super_admin"
                                      or step.get("delegated_to") == user["id"]))
        a["current_role"] = step["role"] if step else ""
    if mine:
        data["items"] = [a for a in data["items"] if a["can_act"]]
    return data


@router.get("/approvals/{request_no}")
async def approval_detail(request_no: str, user: dict = Depends(require("approvals", "view"))):
    doc = await db.approvals.find_one({"request_no": request_no})
    if not doc:
        raise HTTPException(404, "Approval request not found.")
    out = clean(doc)
    step = doc["steps"][doc["current_step"]] if doc["status"] == "pending" and doc["steps"] else None
    out["can_act"] = bool(step and (user["role"] == step["role"] or user["role"] == "super_admin"
                                    or step.get("delegated_to") == user["id"]))
    return out


class ActionIn(BaseModel):
    action: str
    comment: str = ""


@router.post("/approvals/{request_no}/action")
async def action(request_no: str, body: ActionIn,
                 user: dict = Depends(require("approvals", "approve"))):
    doc = await db.approvals.find_one({"request_no": request_no})
    if not doc:
        raise HTTPException(404, "Approval request not found.")
    try:
        result = await ae.act(doc, user, body.action, body.comment)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except PeriodLocked as e:
        raise HTTPException(400, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return result
