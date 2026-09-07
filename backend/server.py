"""SIES FinCore API - modular monolith entrypoint."""
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os
import logging
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from core import db
from auth import auth_router, hash_password, verify_password
from routes_master import router as master_router
from routes_fees import router as fees_router
from routes_finance import router as finance_router
from routes_procurement import router as procurement_router
from routes_dashboard import router as dashboard_router
from routes_audit import router as audit_router
from routes_ai import router as ai_router
from routes_approvals import router as approvals_router
from routes_periods import router as periods_router
from routes_bank import router as bank_router
from routes_reports import router as reports_router
from seed import seed_all
from seed_v2 import seed_v2
from engine import PeriodLocked

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("fincore")

app = FastAPI(title="SIES FinCore API")

app.include_router(auth_router)
for r in (master_router, fees_router, finance_router, procurement_router,
          dashboard_router, audit_router, ai_router, approvals_router,
          periods_router, bank_router, reports_router):
    app.include_router(r)


from fastapi import Request
from fastapi.responses import JSONResponse


@app.exception_handler(PeriodLocked)
async def _period_locked_handler(request: Request, exc: PeriodLocked):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "SIES FinCore"}


async def seed_admin():
    email = os.environ["ADMIN_EMAIL"]
    password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    from core import now_iso
    if existing is None:
        await db.users.insert_one({
            "email": email, "name": "System Administrator", "role": "super_admin",
            "department": "", "password_hash": hash_password(password),
            "active": True, "created_at": now_iso()})
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"email": email},
                                  {"$set": {"password_hash": hash_password(password)}})


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.students.create_index("roll_no")
    await db.journals.create_index("journal_no")
    await db.payments.create_index("idempotency_key", unique=True)
    try:
        await seed_all()
        await seed_v2()
    except Exception as e:
        logger.error(f"Seeding error: {e}")
    await seed_admin()
    logger.info("SIES FinCore startup complete.")


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"),
                   "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    from core import client
    client.close()
