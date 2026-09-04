# SIES FinCore - Product Requirements Document

## Original Problem Statement
Build "SIES FinCore", a premium, production-grade Enterprise College Financial Management, Accounting, Analytics & Intelligence platform for SIES College of Arts, Science & Commerce (Autonomous), Nerul, Navi Mumbai. It must combine an accounting system, financial management, financial analysis, business intelligence and a controlled read-only AI assistant into one auditable institutional source of truth. Quality bar: premium fintech + enterprise accounting software. INR / Indian formatting, dark + light themes, restrained animations, no em dash in visible text.

## Architecture
Modular monolith. React (JS) + FastAPI + MongoDB.
- Money stored as BSON Decimal128 (no floating point) via `core.py` helpers.
- Double-entry accounting engine (`engine.py`): `post_journal` rejects unbalanced entries; trial balance, account balances, financial position all derive from posted journals (single source of truth).
- JWT auth (httpOnly cookies) + bcrypt, brute-force lockout (`auth.py`). RBAC via role -> module -> action map in `core.py`; `require(module, action)` dependency guards every sensitive endpoint. Server-side enforcement (auditor POST payment returns 403, verified).
- Audit logging on sensitive actions (`core.audit`).
- Routers: master/accounting, fees, finance, procurement, dashboard, audit, ai.
- Frontend: AppShell (collapsible sidebar with RBAC nav, header, Ctrl+K command search, FY selector, notifications, theme toggle, user menu), premium startup loader, reusable kit (KpiCard count-up, DataTable, StatusBadge color+icon+text, Currency), Recharts themed charts.

## User Personas
Super Admin, Management, Principal, Finance Manager, Accountant, Auditor, Department Head, Procurement Officer, Student, Vendor.

## Core Requirements (static)
Financial correctness, data integrity, security, auditability, RBAC, INR formatting, traceable drill-down, no fake functionality, AI strictly read-only.

## Implemented (2026-06)
- Auth + RBAC across 10 roles; admin owner iamyourguestbro@gmail.com. Demo users password Sies@2026.
- Accounting engine: Chart of Accounts (39 accounts), Journals (balanced, drill-down), General Ledger, Trial Balance (balanced), Income & Expenditure + Balance Sheet.
- Student Fees: fee structures/components, student ledger, payments with idempotency + outstanding validation, receipts, defaulters, fee analytics.
- Finance: revenue by source, expenses by category, receivables aging, payables aging.
- Budget: department budgets with commitments/available/utilization + alert thresholds, department finance.
- Procurement: vendors + vendor ledger, purchase orders, GRN, invoices with 3-way match (exceptions flagged, not auto-approved), AP.
- Assets registry with depreciation/book value; Grants with utilization.
- Executive Dashboard: 8 KPIs with count-up + drill-down sheets, revenue/expense trend, cash flow, composition donut, department spending.
- Analytics: KPI engine (institutional ratios), statistical forecast (moving average, historical vs projected).
- Audit: activity log + rule-based anomaly review (duplicate invoice, large transaction, 3-way exceptions).
- AI Finance Assistant: read-only, Emergent LLM (gpt-5.4), answers only from verified financial context, Lakh/Crore formatting.
- Realistic seeded demo data with posted journals; FY 2025-26 Revenue ~6.59 Cr, Expenditure ~6.25 Cr, Surplus ~33.6 L; trial balance balanced.
- Dark/light themes (dark default, no flash), premium startup animation, Indian currency formatting, no em dash.

Verified: backend 30/30 pytest pass; frontend E2E core flows pass.

## Backlog
### P1
- Reports Center export (PDF/Excel/CSV) - currently marked Planned.
- Document Vault upload with access control - marked Planned.
- Bank management + reconciliation module.
- Approval engine (configurable thresholds) UI + workflow.
- Financial period close/lock UI.
- Scholarships, Refunds/Concessions modules.
- Manual journal entry form + configurable budget thresholds/approval rules in Administration.
### P2
- MFA, password reset UI.
- AI streaming responses, OCR invoice capture, predictive anomaly detection.
- Data import (Excel/CSV) with staging + rollback.
- Materialized/cached dashboard aggregates for scale.

## Next Tasks
Reports export, Bank reconciliation, Approval engine, Financial period locking.
