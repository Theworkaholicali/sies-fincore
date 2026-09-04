import { useOutletContext } from "react-router-dom";
import { useApi } from "@/hooks/useApi";
import { PageHeader, Panel, SectionTitle, Currency, StatusBadge } from "@/components/kit";
import { DataTable } from "@/components/DataTable";
import { BarSeries } from "@/components/charts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { formatPct } from "@/lib/format";

export default function Budget() {
  const { fy } = useOutletContext();
  return (
    <div>
      <PageHeader title="Budget Management" subtitle="Departmental allocation, actual spend and commitments. Available budget accounts for open purchase orders." />
      <Tabs defaultValue="budgets">
        <TabsList className="mb-4">
          <TabsTrigger value="budgets" data-testid="tab-budgets">Department Budgets</TabsTrigger>
          <TabsTrigger value="dept" data-testid="tab-dept-finance">Department Finance</TabsTrigger>
        </TabsList>
        <TabsContent value="budgets"><Budgets fy={fy} /></TabsContent>
        <TabsContent value="dept"><DeptFinance fy={fy} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Budgets({ fy }) {
  const { data, loading } = useApi("/budgets", { fy }, [fy]);
  const chart = (data?.rows || []).map((r) => ({ label: r.department, approved: r.approved, actual: r.actual }));
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatBox label="Approved" value={data?.total_approved} />
        <StatBox label="Actual Spend" value={data?.total_actual} />
        <StatBox label="Committed" value={data?.total_committed} tone="warning" />
        <StatBox label="Available" value={data?.total_available} tone="positive" />
      </div>
      <Panel className="mb-4">
        <SectionTitle>Budget vs Actual by Department</SectionTitle>
        <BarSeries data={chart} keys={[{ key: "approved", name: "Approved" }, { key: "actual", name: "Actual" }]} height={280} />
      </Panel>
      <DataTable
        testId="budget-table"
        loading={loading}
        rows={data?.rows || []}
        columns={[
          { key: "department_name", header: "Department", sortable: true },
          { key: "approved", header: "Approved", align: "right", render: (r) => <Currency value={r.approved} /> },
          { key: "actual", header: "Actual", align: "right", render: (r) => <Currency value={r.actual} /> },
          { key: "committed", header: "Committed", align: "right", render: (r) => <Currency value={r.committed} /> },
          { key: "available", header: "Available", align: "right", sortable: true, render: (r) => <Currency value={r.available} className={r.available < 0 ? "text-negative font-semibold" : "text-positive"} /> },
          { key: "utilization", header: "Utilization", render: (r) => (
            <div className="flex items-center gap-2 min-w-[140px]">
              <Progress value={Math.min(r.utilization, 100)} className="h-1.5 w-20" />
              <span className="num text-xs">{formatPct(r.utilization)}</span>
            </div>
          ) },
          { key: "alert", header: "Alert", render: (r) => <StatusBadge status={r.alert} /> },
        ]}
      />
    </div>
  );
}

function DeptFinance({ fy }) {
  const { data, loading } = useApi("/department-finance", { fy }, [fy]);
  return (
    <DataTable
      testId="dept-finance-table"
      loading={loading}
      rows={data || []}
      columns={[
        { key: "department_name", header: "Department", sortable: true },
        { key: "approved", header: "Budget", align: "right", render: (r) => <Currency value={r.approved} /> },
        { key: "actual", header: "Spend", align: "right", render: (r) => <Currency value={r.actual} /> },
        { key: "available", header: "Remaining", align: "right", render: (r) => <Currency value={r.available} /> },
        { key: "purchase_orders", header: "POs", align: "right", render: (r) => <span className="num">{r.purchase_orders}</span> },
        { key: "utilization", header: "Utilization", align: "right", sortable: true, render: (r) => <span className="num">{formatPct(r.utilization)}</span> },
      ]}
    />
  );
}

function StatBox({ label, value, tone }) {
  const cls = tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : tone === "warning" ? "text-warning" : "";
  return (
    <Panel className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <Currency value={value} className={`text-lg font-bold ${cls}`} />
    </Panel>
  );
}
