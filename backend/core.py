"""Shared infrastructure: DB, money, base models, RBAC, audit."""
import os
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone
from typing import Any, Optional
from bson import ObjectId
from bson.decimal128 import Decimal128
from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

CENT = Decimal("0.01")


def D(v: Any) -> Decimal:
    if isinstance(v, Decimal128):
        v = v.to_decimal()
    if v is None:
        v = 0
    return Decimal(str(v)).quantize(CENT, rounding=ROUND_HALF_UP)


def dec128(v: Any) -> Decimal128:
    return Decimal128(D(v))


def num(v: Any) -> float:
    """Convert stored money to a JSON-safe float rounded to 2 places."""
    return float(D(v))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def oid(v: Any) -> str:
    return str(v)


def clean(doc: Optional[dict]) -> Optional[dict]:
    """Recursively convert a Mongo document into JSON-safe primitives."""
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k == "_id":
            out["id"] = str(v)
            continue
        out[k] = _conv(v)
    return out


def _conv(v: Any) -> Any:
    if isinstance(v, Decimal128):
        return float(v.to_decimal())
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, dict):
        return {k: _conv(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_conv(x) for x in v]
    return v


# ---------------------------------------------------------------------------
# RBAC
# ---------------------------------------------------------------------------
MODULES = [
    "dashboard", "finance", "accounting", "fees", "budget", "procurement",
    "assets", "grants", "analytics", "reports", "audit", "documents",
    "ai_assistant", "administration", "approvals",
]

ALL = {"view", "create", "edit", "delete", "submit", "approve", "reject",
       "export", "reconcile", "reverse", "configure"}
RO = {"view", "export"}


def _grant(modules, actions):
    return {m: set(actions) for m in modules}


ROLE_PERMISSIONS = {
    "super_admin": {m: set(ALL) for m in MODULES},
    "management": {**_grant(MODULES, RO)},
    "principal": {**_grant(MODULES, RO), "budget": {"view", "approve", "export"},
                  "procurement": {"view", "approve", "export"},
                  "approvals": {"view", "approve", "reject", "return"}},
    "finance_manager": {**_grant(MODULES, ALL), "administration": {"view"},
                        "audit": RO},
    "accountant": {"dashboard": RO, "finance": {"view", "create", "edit", "reconcile"},
                   "accounting": {"view", "create", "edit", "reverse"},
                   "fees": {"view", "create", "edit"}, "budget": RO,
                   "procurement": {"view"}, "reports": RO, "analytics": RO,
                   "documents": {"view", "create"}, "ai_assistant": RO,
                   "approvals": {"view"}},
    "auditor": {**_grant(MODULES, RO)},
    "department_head": {"dashboard": RO, "budget": {"view", "submit", "export"},
                        "procurement": {"view", "create", "submit"},
                        "finance": {"view"}, "reports": RO, "analytics": RO,
                        "ai_assistant": RO,
                        "approvals": {"view", "approve", "reject", "return", "create"}},
    "procurement_officer": {"dashboard": RO,
                            "procurement": {"view", "create", "edit", "submit",
                                            "approve", "reconcile"},
                            "finance": {"view"}, "budget": {"view"},
                            "documents": {"view", "create"}, "reports": RO,
                            "approvals": {"view", "approve", "reject", "return", "create"}},
    "student": {"fees": {"view"}},
    "vendor": {"procurement": {"view"}},
}


def has_perm(role: str, module: str, action: str) -> bool:
    perms = ROLE_PERMISSIONS.get(role, {})
    return action in perms.get(module, set())


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------
async def audit(user: dict, action: str, entity: str, entity_id: str = "",
                summary: str = "", before: Any = None, after: Any = None,
                severity: str = "info"):
    await db.audit_logs.insert_one({
        "user_id": str(user.get("_id", user.get("id", ""))),
        "user_name": user.get("name", ""),
        "role": user.get("role", ""),
        "action": action,
        "entity": entity,
        "entity_id": str(entity_id),
        "summary": summary,
        "before": _conv(before) if isinstance(before, dict) else before,
        "after": _conv(after) if isinstance(after, dict) else after,
        "severity": severity,
        "timestamp": now_iso(),
    })
