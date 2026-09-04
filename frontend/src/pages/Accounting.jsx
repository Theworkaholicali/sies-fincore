import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { PageHeader, Panel, StatusBadge, Currency, SectionTitle, EmptyState } from "@/components/kit";
import { DataTable } from "@/components/DataTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { formatDate } from "@/lib/format";
import { CheckCircle2 } from "lucide-react";

export default function Accounting() {
  const { fy } = useOutletContext();
  return (
    <div>
      <PageHeader
        title="Accounting Engine"
        subtitle="Double entry accounting is the financial source of truth. Every journal must balance before it is posted."
      />
      <Tabs defaultValue="journals">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="journals" data-testid="tab-journals">Journals</TabsTrigger>
          <TabsTrigger value="ledger" data-testid="tab-ledger">General Ledger</TabsTrigger>
          <TabsTrigger value="trial" data-testid="tab-trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="statements" data-testid="tab-statements">Financial Statements</TabsTrigger>
          <TabsTrigger value="coa" data-testid="tab-coa">Chart of Accounts</TabsTrigger>
        </TabsList>
        <TabsContent value="journals"><Journals fy={fy} /></TabsContent>
        <TabsContent value="ledger"><Ledger fy={fy} /></TabsContent>
        <TabsContent value="trial"><TrialBalance fy={fy} /></TabsContent>
        <TabsContent value="statements"><Statements fy={fy} /></TabsContent>
        <TabsContent value="coa"><ChartOfAccounts /></TabsContent>
      </Tabs>
    </div>
  );
}

function Journals({ fy }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const { data, loading } = useApi("/journals", { fy, page, q }, [fy, page, q]);
  const open = async (row) => {
    const r = await api.get(`/journals/${row.journal_no}`);
    setSel(r.data);
  };
  return (
    <>
      <DataTable
        testId="journals-table"
        loading={loading}
        rows={data?.items || []}
        page={page} pages={data?.pages} total={data?.total} onPageChange={setPage}
        search={q} onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Search journal number or narration"
        onRowClick={open}
        columns={[
          { key: "journal_no", header: "Journal", sortable: true, render: (r) => <span className="num font-medium">{r.journal_no}</span> },
          { key: "date", header: "Date", render: (r) => formatDate(r.date) },
          { key: "narration", header: "Narration", className: "max-w-xs truncate" },
          { key: "source", header: "Source", render: (r) => <StatusBadge status="info" label={r.source.replace(/_/g, " ")} /> },
          { key: "total", header: "Amount", align: "right", sortable: true, render: (r) => <Currency value={r.total} /> },
        ]}
      />
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto scrollbar-thin" data-testid="journal-detail-sheet">
          <SheetHeader>
            <SheetTitle className="num">{sel?.journal_no}</SheetTitle>
            <SheetDescription>{sel?.narration}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDate(sel?.date)}</span>
            <span>|</span>
            <StatusBadge status="positive" label="posted" />
          </div>
          <table className="w-full text-sm mt-4">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2">Account</th>
                <th className="text-right py-2">Debit</th>
                <th className="text-right py-2">Credit</th>
              </tr>
            </thead>
            <tbody>
              {sel?.lines?.map((l, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-2">
                    <span className="num text-xs text-muted-foreground">{l.account_code}</span>
                    <span className="block">{l.account_name}</span>
                  </td>
                  <td className="text-right num">{l.debit ? <Currency value={l.debit} /> : ""}</td>
                  <td className="text-right num">{l.credit ? <Currency value={l.credit} /> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-positive-soft border border-positive/20 px-3 py-2 text-sm text-positive">
            <CheckCircle2 className="h-4 w-4" /> Debits equal credits. Entry is balanced.
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Ledger({ fy }) {
  const { data: accounts } = useApi("/accounts", {}, []);
  const [code, setCode] = useState("1010");
  const { data, loading } = useApi("/ledger", { account_code: code, fy }, [code, fy]);
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-muted-foreground">Account</span>
        <Select value={code} onValueChange={setCode}>
          <SelectTrigger className="w-[320px]" data-testid="ledger-account-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {(accounts || []).map((a) => (
              <SelectItem key={a.code} value={a.code}>
                {a.code} - {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && (
          <span className="ml-auto text-sm">
            Closing balance: <Currency value={data.closing} className="font-semibold" />
          </span>
        )}
      </div>
      <DataTable
        testId="ledger-table"
        loading={loading}
        rows={data?.entries || []}
        emptyTitle="No ledger entries"
        emptyMessage="This account has no posted transactions for the selected financial year."
        columns={[
          { key: "date", header: "Date", render: (r) => formatDate(r.date) },
          { key: "journal_no", header: "Journal", render: (r) => <span className="num">{r.journal_no}</span> },
          { key: "narration", header: "Narration", className: "max-w-sm truncate" },
          { key: "debit", header: "Debit", align: "right", render: (r) => r.debit ? <Currency value={r.debit} /> : "" },
          { key: "credit", header: "Credit", align: "right", render: (r) => r.credit ? <Currency value={r.credit} /> : "" },
          { key: "balance", header: "Balance", align: "right", render: (r) => <Currency value={r.balance} className="font-semibold" /> },
        ]}
      />
    </div>
  );
}

function TrialBalance({ fy }) {
  const { data, loading } = useApi("/trial-balance", { fy }, [fy]);
  return (
    <div>
      {data && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <StatusBadge status={data.balanced ? "positive" : "critical"} label={data.balanced ? "Balanced" : "Not balanced"} />
          <span className="text-muted-foreground">
            Total debits and credits both equal <Currency value={data.total_debit} className="font-semibold text-foreground" />
          </span>
        </div>
      )}
      <DataTable
        testId="trial-balance-table"
        loading={loading}
        rows={data?.rows || []}
        columns={[
          { key: "code", header: "Code", render: (r) => <span className="num">{r.code}</span> },
          { key: "name", header: "Account", sortable: true },
          { key: "type", header: "Type", render: (r) => <span className="text-xs text-muted-foreground capitalize">{r.type.toLowerCase()}</span> },
          { key: "debit", header: "Debit", align: "right", render: (r) => r.debit ? <Currency value={r.debit} /> : "" },
          { key: "credit", header: "Credit", align: "right", render: (r) => r.credit ? <Currency value={r.credit} /> : "" },
        ]}
      />
    </div>
  );
}

function Statements({ fy }) {
  const { data, loading } = useApi("/financial-statements", { fy }, [fy]);
  if (loading || !data) return <Panel><p className="text-sm text-muted-foreground">Preparing statements...</p></Panel>;
  const ie = data.income_expenditure;
  const bs = data.balance_sheet;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel>
        <SectionTitle>Income and Expenditure Statement</SectionTitle>
        <StatementBlock title="Income" rows={ie.income} total={ie.total_income} />
        <StatementBlock title="Expenditure" rows={ie.expense} total={ie.total_expense} className="mt-4" />
        <div className="mt-4 flex items-center justify-between border-t-2 border-border pt-3">
          <span className="font-semibold">{ie.surplus >= 0 ? "Surplus" : "Deficit"} for the year</span>
          <Currency value={ie.surplus} className={`font-bold ${ie.surplus >= 0 ? "text-positive" : "text-negative"}`} />
        </div>
      </Panel>
      <Panel>
        <SectionTitle>Balance Sheet</SectionTitle>
        <StatementBlock title="Assets" rows={bs.assets} total={bs.total_assets} />
        <StatementBlock title="Liabilities" rows={bs.liabilities} total={bs.total_liabilities} className="mt-4" />
        <StatementBlock title="Funds and Reserves" rows={[...bs.equity, { code: "S", name: "Surplus transferred to fund", amount: bs.surplus_to_fund }]} total={bs.total_equity} className="mt-4" />
      </Panel>
    </div>
  );
}

function StatementBlock({ title, rows, total, className }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">{title}</p>
      {rows.map((r) => (
        <div key={r.code} className="flex items-center justify-between py-1.5 text-sm border-b border-border/40">
          <span className="text-muted-foreground">{r.name}</span>
          <Currency value={r.amount} />
        </div>
      ))}
      <div className="flex items-center justify-between py-2 text-sm font-semibold">
        <span>Total {title}</span>
        <Currency value={total} />
      </div>
    </div>
  );
}

function ChartOfAccounts() {
  const { data, loading } = useApi("/accounts", {}, []);
  return (
    <DataTable
      testId="coa-table"
      loading={loading}
      rows={data || []}
      columns={[
        { key: "code", header: "Code", sortable: true, render: (r) => <span className="num font-medium">{r.code}</span> },
        { key: "name", header: "Account Name", sortable: true },
        { key: "type", header: "Type", sortable: true, render: (r) => <span className="capitalize text-muted-foreground">{r.type.toLowerCase()}</span> },
        { key: "active", header: "Status", render: (r) => <StatusBadge status={r.active ? "active" : "neutral"} label={r.active ? "active" : "inactive"} /> },
      ]}
    />
  );
}
