"""Configurable, sequential, RBAC-integrated approval engine."""
from core import db, dec128, D, num, now_iso, audit
from engine import next_seq, post_journal, PeriodLocked

DOC_TYPES = ("purchase_order", "invoice", "payment", "expense")


async def resolve_rule(doc_type, department, amount):
    """Return the most specific active rule that matches. Not hardcoded."""
    amount = float(D(amount))
    candidates = []
    async for r in db.approval_rules.find({"doc_type": doc_type, "active": True}):
        lo = float(D(r.get("min_amount", 0)))
        hi = r.get("max_amount")
        hi = float(D(hi)) if hi is not None else None
        if amount < lo:
            continue
        if hi is not None and amount > hi:
            continue
        dept = r.get("department", "*")
        if dept != "*" and dept != department:
            continue
        candidates.append(r)
    if not candidates:
        return None
    # department specific beats wildcard; then narrower amount band
    candidates.sort(key=lambda r: (0 if r.get("department", "*") != "*" else 1,
                                   float(D(r.get("min_amount", 0)))))
    return candidates[0]


async def create_approval(doc_type, reference, department, amount, description,
                          user, expense_account=None, payee=None, period="2025-26",
                          fy="2025-26"):
    rule = await resolve_rule(doc_type, department, amount)
    step_roles = rule["steps"] if rule else ["finance_manager"]
    steps = [{"seq": i, "role": r, "status": "pending", "actor_id": "",
              "actor_name": "", "acted_at": "", "comment": "", "delegated_to": ""}
             for i, r in enumerate(step_roles)]
    seq = await next_seq("approval")
    rno = f"APR-{seq:05d}"
    doc = {
        "request_no": rno, "doc_type": doc_type, "reference": str(reference),
        "department": department, "amount": dec128(amount),
        "description": description, "expense_account": expense_account,
        "payee": payee, "period": period, "financial_year": fy,
        "requested_by": str(user.get("id", user.get("_id", ""))),
        "requested_by_name": user.get("name", "System"),
        "rule_id": str(rule["_id"]) if rule else "",
        "steps": steps, "current_step": 0, "status": "pending",
        "posted": False, "journal_no": "",
        "history": [{"action": "submitted", "by": user.get("name", "System"),
                     "role": user.get("role", ""), "at": now_iso(), "comment": description}],
        "created_at": now_iso(),
    }
    res = await db.approvals.insert_one(doc)
    await audit(user, "submit", "approval", rno,
                f"Raised {doc_type} approval {rno} for {num(amount)}")
    return rno, str(res.inserted_id)


async def _post_if_ready(approval, user):
    """On full approval, post accounting for payment/expense document types."""
    if approval["doc_type"] not in ("payment", "expense"):
        return None
    if approval.get("posted"):
        return approval.get("journal_no")
    acct = approval.get("expense_account") or "5900"
    amt = num(approval["amount"])
    jno, _ = await post_journal(
        f"Approved {approval['doc_type']} {approval['request_no']}: {approval['description']}",
        [{"account_code": acct, "debit": amt, "credit": 0},
         {"account_code": "1010", "debit": 0, "credit": amt}],
        date=now_iso()[:10], period=approval.get("period", ""),
        fy=approval.get("financial_year", "2025-26"),
        source="approval", source_id=approval["request_no"],
        created_by=str(user.get("id", "")), created_by_name=user.get("name", "System"))
    return jno


async def act(approval, user, action, comment=""):
    """action in approve|reject|return|escalate|delegate. Returns updated status."""
    if approval["status"] != "pending":
        raise ValueError("This request is already closed and cannot be actioned.")
    step = approval["steps"][approval["current_step"]]
    role = user["role"]
    allowed = (role == step["role"] or role == "super_admin"
               or step.get("delegated_to") == str(user.get("id", "")))
    if not allowed:
        raise PermissionError(
            f"This step requires the {step['role'].replace('_', ' ')} role.")

    hist = {"action": action, "by": user["name"], "role": role,
            "at": now_iso(), "comment": comment}
    update = {"$push": {"history": hist}}
    new_status = approval["status"]
    journal_no = ""

    if action == "delegate":
        approval["steps"][approval["current_step"]]["delegated_to"] = comment
        update["$set"] = {"steps": approval["steps"]}
    elif action == "escalate":
        approval["steps"][approval["current_step"]]["status"] = "escalated"
        approval["steps"][approval["current_step"]]["role"] = "management"
        update["$set"] = {"steps": approval["steps"]}
    elif action == "reject":
        step.update({"status": "rejected", "actor_id": str(user.get("id", "")),
                     "actor_name": user["name"], "acted_at": now_iso(), "comment": comment})
        new_status = "rejected"
        update["$set"] = {"steps": approval["steps"], "status": "rejected"}
    elif action == "return":
        step.update({"status": "returned", "actor_id": str(user.get("id", "")),
                     "actor_name": user["name"], "acted_at": now_iso(), "comment": comment})
        new_status = "returned"
        update["$set"] = {"steps": approval["steps"], "status": "returned"}
    elif action == "approve":
        step.update({"status": "approved", "actor_id": str(user.get("id", "")),
                     "actor_name": user["name"], "acted_at": now_iso(), "comment": comment})
        if approval["current_step"] + 1 < len(approval["steps"]):
            approval["current_step"] += 1
            update["$set"] = {"steps": approval["steps"],
                              "current_step": approval["current_step"]}
        else:
            new_status = "approved"
            journal_no = await _post_if_ready(approval, user) or ""
            update["$set"] = {"steps": approval["steps"], "status": "approved",
                              "posted": bool(journal_no), "journal_no": journal_no}
            # reflect on the referenced document where applicable
            await _apply_to_document(approval)
    else:
        raise ValueError("Unknown approval action.")

    await db.approvals.update_one({"_id": approval["_id"]}, update)
    await audit(user, action, "approval", approval["request_no"],
                f"{action} on {approval['request_no']} ({approval['doc_type']})")
    return {"status": new_status, "journal_no": journal_no}


async def _apply_to_document(approval):
    ref = approval.get("reference")
    if approval["doc_type"] == "invoice" and ref:
        await db.invoices.update_one({"invoice_no": ref},
                                     {"$set": {"status": "approved", "approved": True}})
    elif approval["doc_type"] == "purchase_order" and ref:
        await db.purchase_orders.update_one({"po_no": ref},
                                            {"$set": {"approved": True}})
