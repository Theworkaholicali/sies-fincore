import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Panel, StatusBadge, Currency, KpiCard, EmptyState } from "@/components/kit";
import { DataTable } from "@/components/DataTable";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatPct } from "@/lib/format";
import { toast } from "sonner";
import { Receipt, Loader2 } from "lucide-react";

export default function Fees() {
  const { user } = useAuth();
  const isStudent = user.role === "student";
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [sel, setSel] = useState(null);
  const [payAmt, setPayAmt] = useState("");
  const [paying, setPaying] = useState(false);

  const { data: summary } = useApi("/fees/summary", {}, []);
  const { data, loading, refetch } = useApi(
    "/fees/students",
    { page, q, status: filter },
    [page, q, filter]
  );

  const openStudent = async (row) => {
    const r = await api.get(`/fees/student/${row.roll_no}`);
    setSel(r.data);
    setPayAmt("");
  };

  const recordPayment = async () => {
    const amt = parseFloat(payAmt);
    if (!amt || amt <= 0) return toast.error("Enter a valid payment amount.");
    setPaying(true);
    try {
      const r = await api.post("/fees/payments", {
        roll_no: sel.fee.roll_no,
        amount: amt,
        mode: "Online",
        idempotency_key: `${sel.fee.roll_no}-${Date.now()}`,
      });
      toast.success(`Payment recorded. Receipt ${r.data.receipt_no}`);
      const fresh = await api.get(`/fees/student/${sel.fee.roll_no}`);
      setSel(fresh.data);
      setPayAmt("");
      refetch();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Payment could not be recorded.");
    } finally {
      setPaying(false);
    }
  };

  const canPay = user.role !== "student" && ["super_admin", "finance_manager", "accountant"].includes(user.role);

  return (
    <div>
      <PageHeader
        title={isStudent ? "My Fees" : "Student Fee Ledger"}
        subtitle={isStudent ? "Your fee summary, dues and payment history." : "Fee collection, outstanding dues and student ledger drill down."}
      />

      {!isStudent && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard testId="kpi-fee-collected" label="Fees Collected" value={summary.paid} status="positive" />
          <KpiCard testId="kpi-fee-outstanding" label="Outstanding" value={summary.outstanding} status="warning" />
          <KpiCard testId="kpi-collection-rate" label="Collection Rate" value={summary.collection_rate} compact={false} status={summary.collection_rate > 80 ? "positive" : "warning"} />
          <KpiCard testId="kpi-defaulters" label="Defaulters" value={summary.defaulters} compact={false} status="critical" />
        </div>
      )}

      {!isStudent && (
        <Tabs value={filter || "all"} onValueChange={(v) => { setFilter(v === "all" ? "" : v); setPage(1); }} className="mb-4">
          <TabsList>
            <TabsTrigger value="all" data-testid="fee-filter-all">All students</TabsTrigger>
            <TabsTrigger value="unpaid" data-testid="fee-filter-unpaid">Defaulters</TabsTrigger>
            <TabsTrigger value="partial" data-testid="fee-filter-partial">Partial</TabsTrigger>
            <TabsTrigger value="paid" data-testid="fee-filter-paid">Paid</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <DataTable
        testId="student-fee-table"
        loading={loading}
        rows={data?.items || []}
        page={page} pages={data?.pages} total={data?.total} onPageChange={setPage}
        search={q} onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Search by name or roll number"
        onRowClick={openStudent}
        columns={[
          { key: "roll_no", header: "Roll No", render: (r) => <span className="num text-xs">{r.roll_no}</span> },
          { key: "student_name", header: "Student", sortable: true },
          { key: "program", header: "Program", render: (r) => <span className="text-xs text-muted-foreground">{r.program}</span> },
          { key: "assigned", header: "Assigned", align: "right", render: (r) => <Currency value={r.assigned} /> },
          { key: "paid", header: "Paid", align: "right", render: (r) => <Currency value={r.paid} /> },
          { key: "outstanding", header: "Outstanding", align: "right", sortable: true, render: (r) => <Currency value={r.outstanding} className={r.outstanding > 0 ? "text-negative font-semibold" : ""} /> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto scrollbar-thin" data-testid="student-ledger-sheet">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle>{sel.fee.student_name}</SheetTitle>
                <SheetDescription>
                  <span className="num">{sel.fee.roll_no}</span> | {sel.fee.program} | {sel.fee.department} department
                </SheetDescription>
              </SheetHeader>

              <div className="grid grid-cols-3 gap-3 mt-5">
                <MiniStat label="Assigned" value={sel.fee.assigned} />
                <MiniStat label="Paid" value={sel.fee.paid} tone="positive" />
                <MiniStat label="Outstanding" value={sel.fee.outstanding} tone={sel.fee.outstanding > 0 ? "negative" : "positive"} />
              </div>

              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mt-6 mb-2">Fee components</p>
              {sel.fee.components?.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 text-sm border-b border-border/40">
                  <span className="text-muted-foreground">{c.name}</span>
                  <Currency value={c.amount} />
                </div>
              ))}

              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mt-6 mb-2">Student ledger</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="text-left py-2">Description</th>
                    <th className="text-right py-2">Debit</th>
                    <th className="text-right py-2">Credit</th>
                    <th className="text-right py-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {sel.ledger.entries?.map((e, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-2">
                        <span className="block">{e.description}</span>
                        <span className="text-xs text-muted-foreground num">{formatDate(e.date)}</span>
                      </td>
                      <td className="text-right num">{e.debit ? <Currency value={e.debit} /> : ""}</td>
                      <td className="text-right num">{e.credit ? <Currency value={e.credit} /> : ""}</td>
                      <td className="text-right num font-medium"><Currency value={e.balance} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {canPay && sel.fee.outstanding > 0 && (
                <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-sm font-semibold mb-3">Record a payment</p>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label htmlFor="pay" className="text-xs">Amount (max {sel.fee.outstanding})</Label>
                      <Input id="pay" data-testid="payment-amount-input" type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} placeholder="0" className="mt-1" />
                    </div>
                    <Button data-testid="record-payment-button" onClick={recordPayment} disabled={paying}>
                      {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Receipt className="h-4 w-4 mr-1" /> Record</>}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  const cls = tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <Currency value={value} className={`text-sm font-bold ${cls}`} />
    </div>
  );
}
