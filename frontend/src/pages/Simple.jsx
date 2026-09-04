import { useApi } from "@/hooks/useApi";
import { PageHeader, Panel, Currency, StatusBadge, SectionTitle, EmptyState } from "@/components/kit";
import { DataTable } from "@/components/DataTable";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatPct } from "@/lib/format";
import { FileText, FolderCheck, Download, Clock } from "lucide-react";

export function Assets() {
  const { data, loading } = useApi("/assets", {}, []);
  return (
    <div>
      <PageHeader title="Asset Registry" subtitle="Fixed asset register with cost, depreciation and current book value." />
      <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
        <Panel className="p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Cost</p><Currency value={data?.total_cost} className="text-lg font-bold" /></Panel>
        <Panel className="p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net Book Value</p><Currency value={data?.total_book_value} className="text-lg font-bold text-positive" /></Panel>
      </div>
      <DataTable
        testId="assets-table"
        loading={loading}
        rows={data?.rows || []}
        columns={[
          { key: "asset_code", header: "Code", render: (r) => <span className="num text-xs">{r.asset_code}</span> },
          { key: "name", header: "Asset", sortable: true },
          { key: "category", header: "Category" },
          { key: "department", header: "Dept" },
          { key: "cost", header: "Cost", align: "right", render: (r) => <Currency value={r.cost} /> },
          { key: "annual_depreciation", header: "Annual Dep.", align: "right", render: (r) => <Currency value={r.annual_depreciation} /> },
          { key: "book_value", header: "Book Value", align: "right", sortable: true, render: (r) => <Currency value={r.book_value} /> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
}

export function Grants() {
  const { data, loading } = useApi("/grants", {}, []);
  return (
    <div>
      <PageHeader title="Grants & Research" subtitle="Research and infrastructure grants with utilization tracking." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading && <Panel><p className="text-sm text-muted-foreground">Loading grants...</p></Panel>}
        {(data || []).map((g) => (
          <Panel key={g.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{g.name}</p>
                <p className="text-xs text-muted-foreground">{g.source}</p>
              </div>
              <StatusBadge status={g.status} />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div><p className="text-[10px] uppercase text-muted-foreground">Sanctioned</p><Currency value={g.amount} className="text-sm font-semibold" /></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Utilized</p><Currency value={g.utilized} className="text-sm font-semibold" /></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Remaining</p><Currency value={g.remaining} className="text-sm font-semibold text-positive" /></div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Progress value={g.utilization_pct} className="h-2 flex-1" />
              <span className="num text-xs font-medium">{formatPct(g.utilization_pct)}</span>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

const REPORTS = [
  "Daily Financial Report", "Monthly Financial Report", "Income and Expenditure Statement",
  "Balance Sheet", "Trial Balance", "Fee Collection Report", "Outstanding Fee Report",
  "Budget vs Actual Report", "Vendor Payables Report", "Grant Utilization Report",
  "Department Financial Report", "Audit Exception Report",
];

export function Reports() {
  return (
    <div>
      <PageHeader title="Reports Center" subtitle="Generate official institutional financial statements and management reports." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r, i) => (
          <Panel key={i} className="flex items-center justify-between hover:border-brand/40 transition-colors" data-testid={`report-${i}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-lg bg-brand/10 p-2 shrink-0"><FileText className="h-4 w-4 text-brand" /></div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r}</p>
                <p className="text-xs text-muted-foreground">PDF, Excel, CSV</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-md px-2 py-1">
              <Clock className="h-3 w-3" /> Planned
            </span>
          </Panel>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        Report export is planned for a later build. Financial statements are already available live under the Accounting Engine.
      </p>
    </div>
  );
}

export function Documents() {
  return (
    <div>
      <PageHeader title="Document Vault" subtitle="Secure, permission controlled repository for financial documents." />
      <Panel>
        <EmptyState
          icon={FolderCheck}
          title="Document upload is planned"
          message="Invoices, receipts, purchase orders and bank statements will be stored here with version history and access control. This capability is scheduled for a later build."
        />
      </Panel>
    </div>
  );
}

export function Administration() {
  const { data, loading } = useApi("/users", {}, []);
  const { data: depts } = useApi("/departments", {}, []);
  return (
    <div>
      <PageHeader title="Administration" subtitle="Users, roles and institutional master data." />
      <SectionTitle>Users and Roles</SectionTitle>
      <DataTable
        testId="users-table"
        loading={loading}
        rows={data || []}
        columns={[
          { key: "name", header: "Name", sortable: true },
          { key: "email", header: "Email", render: (r) => <span className="text-xs num">{r.email}</span> },
          { key: "role", header: "Role", render: (r) => <StatusBadge status="info" label={(r.role || "").replace(/_/g, " ")} /> },
          { key: "department", header: "Dept", render: (r) => r.department || "-" },
          { key: "active", header: "Status", render: (r) => <StatusBadge status={r.active ? "active" : "neutral"} label={r.active ? "active" : "inactive"} /> },
        ]}
      />
      <SectionTitle>Departments</SectionTitle>
      <DataTable
        testId="departments-table"
        rows={depts || []}
        columns={[
          { key: "code", header: "Code", render: (r) => <span className="num">{r.code}</span> },
          { key: "name", header: "Department", sortable: true },
          { key: "active", header: "Status", render: (r) => <StatusBadge status={r.active ? "active" : "neutral"} label={r.active ? "active" : "inactive"} /> },
        ]}
      />
    </div>
  );
}
