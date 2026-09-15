"""Read-only AI Finance Assistant. Consumes only verified financial data."""
import os
from openai import AsyncOpenAI
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core import db, num
from auth import require, get_current_user
from engine import financial_position, account_balances, INCOME, EXPENSE

router = APIRouter(prefix="/api")

SUGGESTED = [
    "What is our total revenue and net surplus this financial year?",
    "Which department has the highest budget utilization?",
    "How much did the college spend on electricity this year?",
    "What is our outstanding student fee amount?",
    "Which expense categories are the largest?",
    "Are there any transactions that require review?",
]


async def _build_context(fy: str) -> str:
    pos = await financial_position(fy)
    bal, accounts = await account_balances(fy)
    exp = sorted([(accounts[c]["name"], v) for c, v in bal.items()
                  if accounts[c]["type"] == EXPENSE and v > 0], key=lambda x: -x[1])
    rev = sorted([(accounts[c]["name"], v) for c, v in bal.items()
                  if accounts[c]["type"] == INCOME and v > 0], key=lambda x: -x[1])
    budgets = await db.budgets.find({"financial_year": fy}).to_list(100)
    budgets.sort(key=lambda b: -b.get("utilization", 0))
    outstanding = 0.0
    async for f in db.student_fees.find():
        outstanding += num(f["outstanding"])
    exceptions = await db.invoices.count_documents({"three_way_match": "exception"})
    defaulters = await db.student_fees.count_documents({"status": "unpaid"})

    lines = [f"Financial Year: {fy}",
             f"Total Revenue: {pos['revenue']}",
             f"Total Expenditure: {pos['expense']}",
             f"Net Surplus: {pos['surplus']}",
             f"Cash in Hand: {pos['cash']}", f"Bank Balance: {pos['bank']}",
             f"Accounts Receivable: {pos['receivable']}",
             f"Accounts Payable: {pos['payable']}",
             f"Salary Expenditure: {pos['salary']}",
             f"Outstanding Student Fees: {round(outstanding, 2)}",
             f"Students with no fee paid: {defaulters}",
             f"Invoices with three way match exceptions: {exceptions}",
             "Revenue by source: " + "; ".join(f"{n}={round(v)}" for n, v in rev),
             "Expenses by category: " + "; ".join(f"{n}={round(v)}" for n, v in exp[:12]),
             "Budget utilization by department: " + "; ".join(
                 f"{b['department_name']}={b.get('utilization', 0)}% (approved {num(b['approved'])}, actual {num(b['actual'])})"
                 for b in budgets)]
    return "\n".join(lines)


SYSTEM = (
    "You are the SIES FinCore Finance Assistant for SIES College of Arts, Science "
    "and Commerce (Autonomous), Nerul. You answer questions about institutional "
    "finances using ONLY the verified financial data provided in the context block. "
    "Rules: Never invent numbers. If the data does not contain the answer, say so "
    "clearly. All amounts are in Indian Rupees; format large values using Lakhs and "
    "Crores where helpful (for example 1.25 Cr, 8.5 lakh). Never use the em dash "
    "character; use commas, colons or hyphens. Be concise, factual and professional, "
    "like an experienced finance analyst. You are strictly read only and cannot "
    "modify, approve, post or delete any financial record. When useful, mention the "
    "financial year the figure relates to."
)


class AskIn(BaseModel):
    question: str
    financial_year: str = "2025-26"


@router.get("/ai/suggestions")
async def suggestions(user: dict = Depends(require("ai_assistant", "view"))):
    return {"suggestions": SUGGESTED}


@router.post("/ai/ask")
async def ask(body: AskIn, user: dict = Depends(require("ai_assistant", "view"))):
    if not body.question.strip():
        raise HTTPException(400, "Please enter a question.")
    context = await _build_context(body.financial_year)
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise HTTPException(503, "AI assistant is not configured.")
    
    try:
        client = AsyncOpenAI(api_key=key)
    
        prompt = (
            f"Verified financial data context:\n{context}\n\n"
            f"Question: {body.question}\n\n"
            f"Answer using only the verified data above."
        )
    
        response = await client.responses.create(
            model=os.environ.get("OPENAI_MODEL", "gpt-5.5"),
            instructions=SYSTEM,
            input=prompt,
        )
    
        answer = response.output_text
    
    except Exception as e:
        raise HTTPException(
            502,
            f"The assistant could not complete the request: {e}"
        )
        await db.ai_chats.insert_one({
            "user_id": user["id"], "question": body.question, "answer": str(answer),
            "financial_year": body.financial_year})
        return {"answer": str(answer), "financial_year": body.financial_year}
