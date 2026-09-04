import { useOutletContext } from "react-router-dom";
import { useApi } from "@/hooks/useApi";
import { PageHeader, Panel, SectionTitle, Currency, KpiCard, StatusBadge } from "@/components/kit";
import { DataTable } from "@/components/DataTable";
import { Donut } from "@/components/charts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatINRCompact } from "@/lib/format";

export default function Finance() {
  const { fy } = useOutletContext();
  const { data: dash } = useApi("/dashboard", { fy }, [fy]);
  const k = dash?.kpis || {};
  return (
    <div>
      <PageHeader title="Financial Control" subtitle="Revenue, expenditure, liquidity and receivables consolidated from the accounting engine." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard testId="fin-kpi-cash" label="Cash in Hand" value={k.cash} status="positive" />
        <KpiCard testId="fin-kpi-bank" label="Bank Balance" value={k.bank} status="positive" />
        <KpiCard testId="fin-kpi-ar" label="Receivables" value={k.receivable} status="warning" />
        <KpiCard testId="fin-kpi-ap" label="Payables" value={k.payable} status="neutral" />
      </div>
      <Tabs defaultValue="revenue">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="revenue" data-testid="tab-revenue">Revenue</TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-expenses">Expenses</TabsTrigger>
          <TabsTrigger value="receivables" data-testid="tab-receivables">Receivables</TabsTrigger>
          <TabsTrigger value="payables" data-testid="tab-payables">Payables Aging</TabsTrigger>
        </TabsList>
        <TabsContent value="revenue"><RevExp url="/revenue" fy={fy} title="Revenue by source" /></TabsContent>
        <TabsContent value="expenses"><RevExp url="/expenses" fy={fy} title="Expenditure by category" /></TabsContent>
        <TabsContent value="receivables"><Receivables /></TabsContent>
        <TabsContent value="payables"><Payables /></TabsContent>
      </Tabs>
    </div>
  );
}

function RevExp({ url, fy, title }) {
  const { data, loading } = useApi(url, { fy }, [url, fy]);
  const donut = (data?.rows || []).slice(0, 6).map((r) => ({ name: r.name, value: r.amount }));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <DataTable
          testId="revexp-table"
          loading={loading}
          rows={data?.rows || []}
          columns={[
            { key: "code", header: "Code", render: (r) => <span className="num text-xs">{r.code}</span> },
            { key: "name", header: "Account", sortable: true },
            { key: "amount", header: "Amount", align: "right", sortable: true, render: (r) => <Currency value={r.amount} /> },
            { key: "share", header: "Share", align: "right", render: (r) => <span className="num text-muted-foreground">{r.share}%</span> },
          ]}
        />
      </div>
      <Panel>
        <SectionTitle>{title}</SectionTitle>
        <Donut data={donut} />
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-semibold">Total</span>
          <Currency value={data?.total} className="font-bold" />
        </div>
      </Panel>
    </div>
  );
}

function Receivables() {
  const { data, loading } = useApi("/receivables/aging", {}, []);
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <StatBox label="Current" value={data?.buckets?.current} />
        <StatBox label="Overdue" value={data?.buckets?.overdue} tone="negative" />
        <StatBox label="Total Receivable" value={data?.total} />
      </div>
      <DataTable
        testId="receivables-table"
        loading={loading}
        rows={data?.rows || []}
        columns={[
          { key: "roll_no", header: "Roll No", render: (r) => <span className="num text-xs">{r.roll_no}</span> },
          { key: "student", header: "Student" },
          { key: "department", header: "Dept" },
          { key: "amount", header: "Outstanding", align: "right", sortable: true, render: (r) => <Currency value={r.amount} /> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
}

function Payables() {
  const { data, loading } = useApi("/payables/aging", {}, []);
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {["0-30", "31-60", "61-90", "90+"].map((b) => (
          <StatBox key={b} label={`${b} days`} value={data?.buckets?.[b]} tone={b === "90+" ? "negative" : undefined} />
        ))}
      </div>
      <DataTable
        testId="payables-table"
        loading={loading}
        rows={data?.rows || []}
        columns={[
          { key: "invoice_no", header: "Invoice", render: (r) => <span className="num text-xs">{r.invoice_no}</span> },
          { key: "vendor", header: "Vendor" },
          { key: "amount", header: "Amount", align: "right", sortable: true, render: (r) => <Currency value={r.amount} /> },
          { key: "days", header: "Age (days)", align: "right", render: (r) => <span className="num">{r.days}</span> },
          { key: "bucket", header: "Bucket", render: (r) => <StatusBadge status={r.bucket === "90+" ? "critical" : "warning"} label={r.bucket} /> },
        ]}
      />
    </div>
  );
}

function StatBox({ label, value, tone }) {
  return (
    <Panel className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <Currency value={value} className={`text-lg font-bold ${tone === "negative" ? "text-negative" : ""}`} />
    </Panel>
  );
}
