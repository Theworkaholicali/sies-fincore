import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { PageHeader, Panel, StatusBadge, SectionTitle } from "@/components/kit";
import { DataTable } from "@/components/DataTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

export default function Audit() {
  return (
    <div>
      <PageHeader title="Audit Trail" subtitle="Immutable record of sensitive financial actions and rule based anomaly review flags." />
      <Tabs defaultValue="logs">
        <TabsList className="mb-4">
          <TabsTrigger value="logs" data-testid="tab-audit-logs">Activity Log</TabsTrigger>
          <TabsTrigger value="anomalies" data-testid="tab-anomalies">Anomaly Review</TabsTrigger>
        </TabsList>
        <TabsContent value="logs"><Logs /></TabsContent>
        <TabsContent value="anomalies"><Anomalies /></TabsContent>
      </Tabs>
    </div>
  );
}

function Logs() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const { data, loading } = useApi("/audit/logs", { page, q }, [page, q]);
  return (
    <DataTable
      testId="audit-logs-table"
      loading={loading}
      rows={data?.items || []}
      page={page} pages={data?.pages} total={data?.total} onPageChange={setPage}
      search={q} onSearch={(v) => { setQ(v); setPage(1); }}
      searchPlaceholder="Search action, entity or user"
      emptyTitle="No audit activity yet"
      emptyMessage="Sensitive financial actions will be recorded here as they occur."
      columns={[
        { key: "timestamp", header: "Time", render: (r) => <span className="text-xs">{formatDate(r.timestamp)}</span> },
        { key: "user_name", header: "User", render: (r) => <div><span className="block text-sm">{r.user_name}</span><span className="text-xs text-muted-foreground capitalize">{(r.role || "").replace(/_/g, " ")}</span></div> },
        { key: "action", header: "Action", render: (r) => <span className="capitalize">{r.action}</span> },
        { key: "entity", header: "Entity", render: (r) => <span className="text-xs num">{r.entity} {r.entity_id}</span> },
        { key: "summary", header: "Details", className: "max-w-xs truncate text-muted-foreground" },
      ]}
    />
  );
}

function Anomalies() {
  const { data, loading } = useApi("/audit/anomalies", {}, []);
  if (loading) return <Panel><p className="text-sm text-muted-foreground">Scanning transactions...</p></Panel>;
  if (!data || data.length === 0)
    return (
      <Panel>
        <SectionTitle>No anomalies flagged</SectionTitle>
        <p className="text-sm text-muted-foreground">All imported transactions currently match internal records and no review items are pending.</p>
      </Panel>
    );
  return (
    <div className="space-y-3">
      {data.map((a, i) => (
        <Panel key={i} className="flex items-start gap-3">
          <div className={`rounded-lg p-2 ${a.severity === "critical" ? "bg-negative-soft" : a.severity === "warning" ? "bg-warning/10" : "bg-info/10"}`}>
            <AlertTriangle className={`h-5 w-5 ${a.severity === "critical" ? "text-negative" : a.severity === "warning" ? "text-warning" : "text-info"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{a.type}</p>
              <StatusBadge status="warning" label={a.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{a.detail}</p>
            <p className="text-xs text-muted-foreground mt-1 num">Refs: {a.refs.join(", ")}</p>
          </div>
        </Panel>
      ))}
    </div>
  );
}
