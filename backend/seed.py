"""Idempotent demo data seeding for SIES FinCore."""
import random
from datetime import datetime, timezone, timedelta
from core import db, dec128, now_iso, D
from auth import hash_password
from engine import post_journal, next_seq

random.seed(42)

# Chart of Accounts
ACCOUNTS = [
    ("1000", "Cash in Hand", "ASSET"),
    ("1010", "Bank - Operating Account", "ASSET"),
    ("1020", "Bank - Fee Collection Account", "ASSET"),
    ("1100", "Accounts Receivable", "ASSET"),
    ("1200", "Fixed Assets", "ASSET"),
    ("1210", "Accumulated Depreciation", "ASSET"),
    ("2000", "Accounts Payable", "LIABILITY"),
    ("2100", "Statutory Dues Payable", "LIABILITY"),
    ("2200", "Fees Received in Advance", "LIABILITY"),
    ("3000", "General Fund", "EQUITY"),
    ("3100", "Corpus Fund", "EQUITY"),
    ("4000", "Tuition Fees", "INCOME"),
    ("4010", "Examination Fees", "INCOME"),
    ("4020", "Laboratory Fees", "INCOME"),
    ("4030", "Library Fees", "INCOME"),
    ("4040", "Development Fees", "INCOME"),
    ("4100", "Government Grants", "INCOME"),
    ("4110", "Donations", "INCOME"),
    ("4120", "Interest Income", "INCOME"),
    ("4130", "Hostel Income", "INCOME"),
    ("4140", "Miscellaneous Income", "INCOME"),
    ("5000", "Salaries", "EXPENSE"),
    ("5010", "Staff Benefits", "EXPENSE"),
    ("5100", "Electricity", "EXPENSE"),
    ("5110", "Water Charges", "EXPENSE"),
    ("5120", "Internet & Telephone", "EXPENSE"),
    ("5130", "Maintenance", "EXPENSE"),
    ("5140", "Repairs", "EXPENSE"),
    ("5200", "Laboratory Consumables", "EXPENSE"),
    ("5210", "Library Books & Journals", "EXPENSE"),
    ("5220", "IT & Software", "EXPENSE"),
    ("5300", "Printing & Stationery", "EXPENSE"),
    ("5400", "Events & Seminars", "EXPENSE"),
    ("5500", "Security Services", "EXPENSE"),
    ("5510", "Housekeeping", "EXPENSE"),
    ("5600", "Depreciation", "EXPENSE"),
    ("5700", "Professional Services", "EXPENSE"),
    ("5800", "Travel & Conveyance", "EXPENSE"),
    ("5900", "Miscellaneous Expense", "EXPENSE"),
]

DEPARTMENTS = [
    ("CS", "Computer Science"), ("IT", "Information Technology"),
    ("COM", "Commerce"), ("BMS", "Management Studies"),
    ("BIO", "Biotechnology"), ("PHY", "Physics"),
    ("CHE", "Chemistry"), ("MAT", "Mathematics"),
]

PROGRAMS = [
    ("BSc-CS", "B.Sc Computer Science", "CS"),
    ("BSc-IT", "B.Sc Information Technology", "IT"),
    ("BCom", "B.Com", "COM"),
    ("BMS", "Bachelor of Management Studies", "BMS"),
    ("BSc-BIO", "B.Sc Biotechnology", "BIO"),
    ("MSc-CS", "M.Sc Computer Science", "CS"),
]

FIRST = ["Aarav", "Vivaan", "Aditya", "Ananya", "Diya", "Ishaan", "Kavya",
         "Rohan", "Sanya", "Arjun", "Meera", "Kabir", "Riya", "Neha",
         "Aryan", "Tara", "Dev", "Sara", "Krishna", "Anjali", "Rahul",
         "Priya", "Karan", "Simran", "Yash", "Isha", "Nikhil", "Pooja"]
LAST = ["Sharma", "Patil", "Iyer", "Nair", "Shah", "Deshmukh", "Reddy",
        "Kulkarni", "Menon", "Joshi", "Gupta", "Rao", "Naik", "Bhat"]

VENDORS = [
    ("Techno Solutions Pvt Ltd", "IT & Software", "5220"),
    ("Sunrise Electricals", "Electrical", "5140"),
    ("Global Lab Supplies", "Laboratory", "5200"),
    ("Bright Stationers", "Stationery", "5300"),
    ("Metro Facility Services", "Housekeeping", "5510"),
    ("Guardian Security Services", "Security", "5500"),
    ("Knowledge Books House", "Library", "5210"),
    ("Cool Air Systems", "Maintenance", "5130"),
    ("Nerul Printers", "Printing", "5300"),
    ("Apex Furniture Works", "Furniture", "1200"),
]

MONTHS = [("2025-04", "April 2025"), ("2025-05", "May 2025"),
          ("2025-06", "June 2025"), ("2025-07", "July 2025"),
          ("2025-08", "August 2025"), ("2025-09", "September 2025"),
          ("2025-10", "October 2025"), ("2025-11", "November 2025"),
          ("2025-12", "December 2025"), ("2026-01", "January 2026"),
          ("2026-02", "February 2026"), ("2026-03", "March 2026")]

EXPENSE_ACCTS = ["5100", "5110", "5120", "5130", "5200", "5210", "5220",
                 "5300", "5400", "5500", "5510", "5700", "5800", "5900"]


async def already_seeded():
    return await db.system_flags.find_one({"_id": "seeded"}) is not None


async def seed_all():
    if await already_seeded():
        return
    await _accounts()
    await _master()
    users = await _users()
    await _assets()
    await _opening_balances()
    students = await _students()
    await _fees_and_payments(students)
    await _grants_and_revenue()
    vendors = await _procurement_and_expenses()
    await _salaries()
    await _budgets()
    await db.system_flags.insert_one({"_id": "seeded", "at": now_iso()})


async def _opening_balances():
    """Opening balances funded by corpus fund at the start of the year."""
    total_assets_cost = 0
    async for a in db.assets.find():
        total_assets_cost += float(D(a["cost"]))
    lines = [
        {"account_code": "1010", "debit": 60000000, "credit": 0, "description": "Operating bank opening balance"},
        {"account_code": "1020", "debit": 5000000, "credit": 0, "description": "Fee collection bank opening balance"},
        {"account_code": "1000", "debit": 500000, "credit": 0, "description": "Cash opening balance"},
        {"account_code": "1200", "debit": total_assets_cost, "credit": 0, "description": "Fixed assets brought forward"},
    ]
    corpus = 60000000 + 5000000 + 500000 + total_assets_cost
    lines.append({"account_code": "3100", "debit": 0, "credit": corpus,
                  "description": "Corpus and general fund"})
    await post_journal("Opening balances for FY 2025-26", lines,
                       date="2025-04-01", period="2025-04", fy="2025-26",
                       source="opening", source_id="OPENING",
                       created_by_name="Opening Balance")


async def _accounts():
    for code, name, typ in ACCOUNTS:
        await db.accounts.update_one(
            {"code": code},
            {"$set": {"code": code, "name": name, "type": typ, "active": True,
                      "created_at": now_iso()}}, upsert=True)


async def _master():
    for code, name in DEPARTMENTS:
        await db.departments.update_one(
            {"code": code}, {"$set": {"code": code, "name": name, "active": True}},
            upsert=True)
    for code, name, dept in PROGRAMS:
        await db.programs.update_one(
            {"code": code},
            {"$set": {"code": code, "name": name, "department": dept}}, upsert=True)
    fys = [{"code": "2024-25", "start": "2024-04-01", "end": "2025-03-31", "status": "closed"},
           {"code": "2025-26", "start": "2025-04-01", "end": "2026-03-31", "status": "open", "active": True},
           {"code": "2026-27", "start": "2026-04-01", "end": "2027-03-31", "status": "open"}]
    for f in fys:
        await db.financial_years.update_one({"code": f["code"]}, {"$set": f}, upsert=True)
    for code, label in MONTHS:
        await db.financial_periods.update_one(
            {"code": code},
            {"$set": {"code": code, "label": label, "financial_year": "2025-26",
                      "status": "open"}}, upsert=True)
    ay = [{"code": "2025-26", "active": True}, {"code": "2026-27"}]
    for a in ay:
        await db.academic_years.update_one({"code": a["code"]}, {"$set": a}, upsert=True)


async def _users():
    people = [
        ("iamyourguestbro@gmail.com", "System Administrator", "super_admin", ""),
        ("management@sies.edu.in", "Dr. R. Venkataraman", "management", ""),
        ("principal@sies.edu.in", "Dr. Sudha Nair", "principal", ""),
        ("finance@sies.edu.in", "Mr. Anil Kulkarni", "finance_manager", ""),
        ("accountant@sies.edu.in", "Mrs. Shweta Deshmukh", "accountant", ""),
        ("auditor@sies.edu.in", "Mr. P. Krishnan", "auditor", ""),
        ("hod.cs@sies.edu.in", "Dr. Meena Iyer", "department_head", "CS"),
        ("procurement@sies.edu.in", "Mr. Sanjay Patil", "procurement_officer", ""),
    ]
    for email, name, role, dept in people:
        await db.users.update_one(
            {"email": email},
            {"$setOnInsert": {
                "email": email, "name": name, "role": role, "department": dept,
                "password_hash": hash_password("Sies@2026"),
                "active": True, "created_at": now_iso()}}, upsert=True)
    # ensure admin password matches env
    return people


async def _students():
    students = []
    for i in range(160):
        prog = random.choice(PROGRAMS)
        dept = prog[2]
        year = random.choice([1, 2, 3])
        sem = year * 2 - random.choice([0, 1])
        name = f"{random.choice(FIRST)} {random.choice(LAST)}"
        roll = f"SIES{2023 + (3 - year)}{prog[0].replace('-', '')[:4].upper()}{i:03d}"
        doc = {
            "roll_no": roll, "name": name, "program": prog[0],
            "program_name": prog[1], "department": dept, "year": year,
            "semester": sem, "academic_year": "2025-26",
            "email": f"{name.split()[0].lower()}.{i}@student.sies.edu.in",
            "phone": f"9{random.randint(100000000, 999999999)}",
            "active": True, "created_at": now_iso(),
        }
        res = await db.students.insert_one(doc)
        doc["_id"] = res.inserted_id
        students.append(doc)
    return students


FEE_COMPONENTS = [("Tuition Fee", "4000", 0.55), ("Examination Fee", "4010", 0.08),
                  ("Laboratory Fee", "4020", 0.12), ("Library Fee", "4030", 0.07),
                  ("Development Fee", "4040", 0.18)]


async def _fees_and_payments(students):
    base_by_prog = {"BSc-CS": 62000, "BSc-IT": 60000, "BCom": 28000,
                    "BMS": 45000, "BSc-BIO": 58000, "MSc-CS": 72000}
    for s in students:
        total = base_by_prog.get(s["program"], 40000)
        components = []
        for cname, acct, pct in FEE_COMPONENTS:
            amt = round(total * pct / 10) * 10
            components.append({"name": cname, "account_code": acct, "amount": dec128(amt)})
        assigned = sum(D(c["amount"]) for c in components)
        # concession/scholarship for some
        concession = 0
        if random.random() < 0.12:
            concession = round(float(assigned) * random.choice([0.15, 0.25, 0.5]))
        # payment pattern
        r = random.random()
        if r < 0.62:
            paid = float(assigned) - concession  # fully paid
        elif r < 0.85:
            paid = round((float(assigned) - concession) * random.choice([0.4, 0.5, 0.6]))
        else:
            paid = 0  # defaulter
        net = float(assigned) - concession
        outstanding = net - paid
        sf = {
            "student_id": str(s["_id"]), "roll_no": s["roll_no"],
            "student_name": s["name"], "program": s["program"],
            "department": s["department"], "academic_year": "2025-26",
            "components": components, "assigned": dec128(assigned),
            "concession": dec128(concession), "paid": dec128(paid),
            "outstanding": dec128(outstanding),
            "status": "paid" if outstanding <= 0 else ("partial" if paid > 0 else "unpaid"),
            "due_date": "2025-08-15", "created_at": now_iso(),
        }
        await db.student_fees.insert_one(sf)
        # ledger + payment + journal
        ledger = [{"date": "2025-06-15", "description": "Fee assigned for AY 2025-26",
                   "debit": dec128(assigned), "credit": dec128(0),
                   "balance": dec128(assigned), "ref": "FEE-ASSIGN"}]
        running = D(assigned)
        if concession:
            running -= D(concession)
            ledger.append({"date": "2025-06-20", "description": "Scholarship / concession applied",
                           "debit": dec128(0), "credit": dec128(concession),
                           "balance": dec128(running), "ref": "CONCESSION"})
        if paid > 0:
            seq = await next_seq("receipt")
            rno = f"RCPT-{seq:06d}"
            pdate = f"2025-{random.choice(['07', '08', '09']):>02}-{random.randint(1, 28):02d}"
            running -= D(paid)
            ledger.append({"date": pdate, "description": f"Payment received ({rno})",
                           "debit": dec128(0), "credit": dec128(paid),
                           "balance": dec128(running), "ref": rno})
            mode = random.choice(["Online", "UPI", "NEFT", "Cash"])
            payment = {
                "receipt_no": rno, "student_id": str(s["_id"]), "roll_no": s["roll_no"],
                "student_name": s["name"], "amount": dec128(paid), "mode": mode,
                "date": pdate, "period": f"2025-{pdate[5:7]}", "financial_year": "2025-26",
                "status": "success", "idempotency_key": f"seed-{s['roll_no']}",
                "created_at": now_iso(),
            }
            await db.payments.insert_one(payment)
            # journal: Dr Bank (or Cash), Cr fee income by component share
            debit_acct = "1000" if mode == "Cash" else "1020"
            lines = [{"account_code": debit_acct, "debit": paid, "credit": 0,
                      "description": f"Fee received {s['roll_no']}"}]
            remaining = D(paid)
            for idx, c in enumerate(components):
                share = (D(c["amount"]) / D(assigned) * D(paid))
                if idx == len(components) - 1:
                    share = remaining
                remaining -= D(share)
                if D(share) > 0:
                    lines.append({"account_code": c["account_code"], "debit": 0,
                                  "credit": D(share), "description": c["name"]})
            await post_journal(f"Student fee collection {rno}", lines, date=pdate,
                               period=f"2025-{pdate[5:7]}", fy="2025-26",
                               source="fee_payment", source_id=rno,
                               created_by_name="Fee Collection")
        await db.student_ledgers.insert_one(
            {"student_id": str(s["_id"]), "roll_no": s["roll_no"], "entries": ledger})


async def _grants_and_revenue():
    grants = [
        ("UGC Research Development Grant", "UGC", 4500000, 3200000),
        ("RUSA Infrastructure Grant", "RUSA", 8000000, 5100000),
        ("DST Laboratory Modernization", "DST", 2500000, 1800000),
        ("Alumni Endowment Fund", "Alumni Association", 1500000, 900000),
    ]
    for name, src, amount, used in grants:
        gdoc = {"name": name, "source": src, "amount": dec128(amount),
                "utilized": dec128(used), "remaining": dec128(amount - used),
                "start": "2025-04-01", "end": "2026-03-31", "status": "active",
                "financial_year": "2025-26", "created_at": now_iso()}
        await db.grants.insert_one(gdoc)
        # revenue recognized as received in bank
        await post_journal(f"Grant received: {name}",
                           [{"account_code": "1010", "debit": used, "credit": 0},
                            {"account_code": "4100", "debit": 0, "credit": used}],
                           date="2025-05-10", period="2025-05", fy="2025-26",
                           source="grant", source_id=name, created_by_name="Grants")
    # donations, interest, hostel, misc
    misc = [("4110", 1250000, "Donation from SIES Trust"),
            ("4120", 680000, "Fixed deposit interest"),
            ("4130", 2200000, "Hostel and mess income"),
            ("4140", 540000, "Auditorium and facility rental")]
    for acct, amt, desc in misc:
        await post_journal(desc,
                           [{"account_code": "1010", "debit": amt, "credit": 0},
                            {"account_code": acct, "debit": 0, "credit": amt}],
                           date="2025-09-05", period="2025-09", fy="2025-26",
                           source="revenue", source_id=desc, created_by_name="Revenue")


async def _procurement_and_expenses():
    vendors = []
    for name, cat, acct in VENDORS:
        seq = await next_seq("vendor")
        vdoc = {"vendor_code": f"VEN-{seq:04d}", "name": name, "category": cat,
                "expense_account": acct, "gstin": f"27ABCDE{random.randint(1000, 9999)}F1Z5",
                "email": f"accounts@{name.split()[0].lower()}.com",
                "phone": f"022{random.randint(20000000, 29999999)}",
                "status": "active", "created_at": now_iso()}
        res = await db.vendors.insert_one(vdoc)
        vdoc["_id"] = res.inserted_id
        vendors.append(vdoc)

    dept_codes = [d[0] for d in DEPARTMENTS]
    # Create POs -> GRN -> Invoices -> Payments across the year
    for m, (period, plabel) in enumerate(MONTHS):
        n_orders = random.randint(3, 5)
        for _ in range(n_orders):
            v = random.choice(vendors)
            dept = random.choice(dept_codes)
            qty = random.randint(2, 40)
            rate = random.choice([1500, 2200, 3500, 5000, 8500, 12000, 25000])
            amount = qty * rate
            pseq = await next_seq("po")
            po_no = f"PO-{pseq:05d}"
            item = {"IT & Software": "Software licenses", "Electrical": "Electrical fittings",
                    "Laboratory": "Lab reagents", "Stationery": "Office supplies",
                    "Housekeeping": "Cleaning materials", "Security": "Security service",
                    "Library": "Reference books", "Maintenance": "AC servicing",
                    "Printing": "Printed material", "Furniture": "Furniture units"}.get(v["category"], "Goods")
            pdate = f"{period}-05"
            po = {"po_no": po_no, "vendor_id": str(v["_id"]), "vendor_name": v["name"],
                  "department": dept, "item": item, "quantity": qty, "rate": dec128(rate),
                  "amount": dec128(amount), "date": pdate, "period": period,
                  "financial_year": "2025-26", "expense_account": v["expense_account"],
                  "status": "closed", "created_at": now_iso()}
            await db.purchase_orders.insert_one(po)
            # GRN
            gseq = await next_seq("grn")
            grn_no = f"GRN-{gseq:05d}"
            recv_qty = qty if random.random() < 0.9 else qty - random.randint(1, 2)
            grn = {"grn_no": grn_no, "po_no": po_no, "vendor_name": v["name"],
                   "received_qty": recv_qty, "ordered_qty": qty,
                   "date": f"{period}-12", "period": period,
                   "status": "received", "created_at": now_iso()}
            await db.goods_receipts.insert_one(grn)
            # Invoice + 3-way match
            iseq = await next_seq("invoice")
            inv_no = f"INV-{iseq:05d}"
            inv_qty = recv_qty
            inv_amount = inv_qty * rate
            match = (inv_qty == qty and recv_qty == qty)
            capex = v["expense_account"] == "1200"
            idate = f"{period}-18"
            inv = {"invoice_no": inv_no, "po_no": po_no, "grn_no": grn_no,
                   "vendor_id": str(v["_id"]), "vendor_name": v["name"],
                   "department": dept, "amount": dec128(inv_amount),
                   "expense_account": v["expense_account"], "date": idate,
                   "period": period, "financial_year": "2025-26",
                   "three_way_match": "matched" if match else "exception",
                   "match_note": "" if match else "Invoice quantity differs from PO and GRN",
                   "status": "paid" if match else "on_hold",
                   "created_at": now_iso()}
            await db.invoices.insert_one(inv)
            # Accounting: on invoice -> Dr expense/asset, Cr AP
            await post_journal(f"Vendor invoice {inv_no} ({v['name']})",
                               [{"account_code": v["expense_account"], "debit": inv_amount, "credit": 0},
                                {"account_code": "2000", "debit": 0, "credit": inv_amount}],
                               date=idate, period=period, fy="2025-26",
                               source="invoice", source_id=inv_no, created_by_name="Procurement")
            if match:
                # payment -> Dr AP, Cr Bank
                payseq = await next_seq("vpay")
                vpay_no = f"VPY-{payseq:05d}"
                await db.vendor_payments.insert_one(
                    {"payment_no": vpay_no, "invoice_no": inv_no, "vendor_name": v["name"],
                     "amount": dec128(inv_amount), "date": f"{period}-25", "period": period,
                     "financial_year": "2025-26", "status": "paid", "created_at": now_iso()})
                await post_journal(f"Payment to vendor {v['name']} ({vpay_no})",
                                   [{"account_code": "2000", "debit": inv_amount, "credit": 0},
                                    {"account_code": "1010", "debit": 0, "credit": inv_amount}],
                                   date=f"{period}-25", period=period, fy="2025-26",
                                   source="vendor_payment", source_id=vpay_no,
                                   created_by_name="Accounts Payable")
    # standalone utility expenses monthly (electricity, water, internet, salaries handled separately)
    for period, plabel in MONTHS:
        for acct, base in [("5100", 380000), ("5110", 90000), ("5120", 65000),
                           ("5510", 150000), ("5500", 220000)]:
            amt = base + random.randint(-20000, 40000)
            await post_journal(f"{plabel} utility/service expense",
                               [{"account_code": acct, "debit": amt, "credit": 0},
                                {"account_code": "1010", "debit": 0, "credit": amt}],
                               date=f"{period}-28", period=period, fy="2025-26",
                               source="expense", source_id=f"{acct}-{period}",
                               created_by_name="Accounts")
    return vendors


async def _salaries():
    for period, plabel in MONTHS:
        gross = 3500000 + random.randint(-80000, 200000)
        await post_journal(f"{plabel} payroll",
                           [{"account_code": "5000", "debit": gross, "credit": 0},
                            {"account_code": "1010", "debit": 0, "credit": round(gross * 0.88)},
                            {"account_code": "2100", "debit": 0, "credit": round(gross * 0.12)}],
                           date=f"{period}-30", period=period, fy="2025-26",
                           source="payroll", source_id=f"payroll-{period}",
                           created_by_name="Payroll")
        # Government salary grant reimbursement (aided college)
        grant_amt = round(gross * 1.02)
        await post_journal(f"{plabel} government salary grant",
                           [{"account_code": "1010", "debit": grant_amt, "credit": 0},
                            {"account_code": "4100", "debit": 0, "credit": grant_amt}],
                           date=f"{period}-05", period=period, fy="2025-26",
                           source="grant", source_id=f"salgrant-{period}",
                           created_by_name="Government Grant")


async def _budgets():
    dept_budgets = {"CS": 4500000, "IT": 3800000, "COM": 2600000, "BMS": 2400000,
                    "BIO": 3200000, "PHY": 2800000, "CHE": 2900000, "MAT": 1800000}
    # actuals from invoices per department
    for code, name in DEPARTMENTS:
        approved = dept_budgets.get(code, 2000000)
        actual = 0
        async for inv in db.invoices.find({"department": code}):
            actual += float(D(inv["amount"]))
        commitments = 0
        async for po in db.purchase_orders.find({"department": code, "status": "open"}):
            commitments += float(D(po["amount"]))
        await db.budgets.insert_one({
            "department": code, "department_name": name, "financial_year": "2025-26",
            "category": "Operational", "approved": dec128(approved),
            "actual": dec128(actual), "committed": dec128(commitments),
            "available": dec128(approved - actual - commitments),
            "utilization": round(actual / approved * 100, 1) if approved else 0,
            "status": "approved", "created_at": now_iso()})


async def _assets():
    assets = [("Server Infrastructure", "IT Equipment", 3500000, "CS", 5),
              ("Chemistry Lab Equipment", "Laboratory", 2200000, "CHE", 10),
              ("Library Furniture", "Furniture", 850000, "COM", 10),
              ("Auditorium AV System", "Electronics", 1800000, "BMS", 8),
              ("Campus Solar Panels", "Infrastructure", 4200000, "PHY", 15)]
    for name, cat, cost, dept, life in assets:
        dep_rate = round(cost / life)
        await db.assets.insert_one({
            "asset_code": f"AST-{random.randint(1000, 9999)}", "name": name,
            "category": cat, "cost": dec128(cost), "department": dept,
            "useful_life": life, "annual_depreciation": dec128(dep_rate),
            "book_value": dec128(cost - dep_rate), "purchase_date": "2025-04-15",
            "status": "in_use", "created_at": now_iso()})
