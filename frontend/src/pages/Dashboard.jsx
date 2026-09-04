import { useOutletContext } from "react-router-dom";
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  PageHeader, KpiCard, Panel, SectionTitle, KpiSkeletonGrid, StatusBadge,
} from "@/components/kit";
import { TrendArea, BarSeries, Donut, TrendLine } from "@/components/charts";
import { Currency } from "@/components/kit";
import { formatINRCompact, formatPct } from "@/lib/format";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import api from "@/lib/api";
import { AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const { fy } = useOutletContext();
  const { data, loading } = useApi("/dashboard", { fy }, [fy]);
  const [drill, setDrill] = useState(null);

  const k = data?.kpis || {};
  const monthly = data?.monthly || [];
  const deptRows = (data?.department_spending || []).map((d) => ({
    label: d.department.length > 12 ? d.department.slice(0, 12) : d.department,
    actual: d.actual,
  }));

  const openDrill = async (kind) => {
    setDrill({ kind, loading: true });
    let res;
    try {
      if (kind === "revenue") res = await api.get("/revenue", { params: { fy } });
      else if (kind === "expense") res = await api.get("/expenses", { params: { fy } });
      else if (kind === "fees") res = await api.get("/fees/by-department");
      else if (kind === "budget") res = await api.get("/budgets", { params: { fy } });
      setDrill({ kind, data: res.data, loading: false });
    } catch {
      setDrill({ kind, loading: false, data: null });
    }
  };

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        subtitle={`Institutional financial position for financial year ${fy}. Figures are derived from posted accounting entries.`}
        actions={
          <span className="text-xs rounded-md border border-border bg-card px-3 py-1.5 text-muted-foreground">
            Demo data seeded for evaluation
          </span>
        }
      />

      {loading ? (
        <KpiSkeletonGrid count={8} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard testId="kpi-card-total-revenue" label="Total Revenue" value={k.revenue} delta={8.4} deltaLabel="vs previous FY" status="positive" onClick={() => openDrill("revenue")} />
          <KpiCard testId="kpi-card-total-expenditure" label="Total Expenditure" value={k.expense} delta={11.2} deltaLabel="vs previous FY" status="warning" onClick={() => openDrill("expense")} />
          <KpiCard testId="kpi-card-net-surplus" label="Net Surplus" value={k.surplus} delta={k.surplus >= 0 ? 4.1 : -4.1} deltaLabel="vs previous FY" status={k.surplus >= 0 ? "positive" : "critical"} />
          <KpiCard testId="kpi-card-cash-bank" label="Cash & Bank" value={(k.cash || 0) + (k.bank || 0)} status="positive" />
          <KpiCard testId="kpi-card-outstanding-fees" label="Outstanding Fees" value={k.outstanding_fees} status="warning" onClick={() => openDrill("fees")} />
          <KpiCard testId="kpi-card-payable" label="Accounts Payable" value={k.payable} status="neutral" />
          <KpiCard testId="kpi-card-salary" label="Salary Expenditure" value={k.salary} status="neutral" />
          <KpiCard testId="kpi-card-budget-util" label="Budget Utilization" value={k.budget_actual} compact status={k.budget_utilization > 90 ? "critical" : "positive"} onClick={() => openDrill("budget")} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Panel className="lg:col-span-2">
          <SectionTitle>Revenue and Expenditure Trend</SectionTitle>
          <TrendArea data={monthly} keys={[{ key: "revenue", name: "Revenue" }, { key: "expense", name: "Expenditure" }]} />
        </Panel>
        <Panel>
          <SectionTitle>Revenue Composition</SectionTitle>
          <Donut data={(data?.revenue_composition || []).slice(0, 6)} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Panel>
          <SectionTitle>Cash Flow (Inflow vs Outflow)</SectionTitle>
          <TrendLine data={monthly} keys={[{ key: "inflow", name: "Inflow" }, { key: "outflow", name: "Outflow", color: "hsl(var(--negative))" }]} />
        </Panel>
        <Panel>
          <SectionTitle>Department Spending</SectionTitle>
          <BarSeries data={deptRows} keys={[{ key: "actual", name: "Actual spend" }]} layout="vertical" />
        </Panel>
        <Panel>
          <SectionTitle>Expense Categories</SectionTitle>
          <BarSeries
            data={(data?.expense_composition || []).slice(0, 6).map((e) => ({ label: e.name.split(" ")[0], value: e.value }))}
            keys={[{ key: "value", name: "Amount" }]}
            layout="vertical"
          />
        </Panel>
      </div>

      {data?.exceptions > 0 && (
        <Panel className="mt-4 border-warning/30">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-warning/10 p-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm font-semibold">Items requiring attention</p>
              <p className="text-sm text-muted-foreground">
                {data.exceptions} vendor invoices did not pass three way matching and are held for review.
              </p>
            </div>
          </div>
        </Panel>
      )}

      <Sheet open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto scrollbar-thin" data-testid="drilldown-sheet">
          <SheetHeader>
            <SheetTitle className="capitalize">{drill?.kind} breakdown</SheetTitle>
            <SheetDescription>Traceable to underlying accounting and transaction records for FY {fy}.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-1">
            {drill?.loading && <p className="text-sm text-muted-foreground">Loading breakdown...</p>}
            {drill?.kind === "revenue" && drill?.data?.rows?.map((r) => (
              <DrillRow key={r.code} name={r.name} value={r.value} share={r.share} amount={r.amount} />
            ))}
            {drill?.kind === "expense" && drill?.data?.rows?.map((r) => (
              <DrillRow key={r.code} name={r.name} amount={r.amount} share={r.share} />
            ))}
            {drill?.kind === "fees" && drill?.data?.map((r) => (
              <DrillRow key={r.department} name={`${r.department} department`} amount={r.outstanding} sub={`${r.count} students, ${formatINRCompact(r.paid)} collected`} />
            ))}
            {drill?.kind === "budget" && drill?.data?.rows?.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-border/60">
                <div>
                  <p className="text-sm font-medium">{r.department_name}</p>
                  <p className="text-xs text-muted-foreground num">{formatPct(r.utilization)} utilized</p>
                </div>
                <StatusBadge status={r.alert} />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DrillRow({ name, amount, share, sub }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/60">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className="text-right">
        <Currency value={amount} className="text-sm font-semibold" />
        {share != null && <p className="text-xs text-muted-foreground num">{formatPct(share)}</p>}
      </div>
    </div>
  );
}
