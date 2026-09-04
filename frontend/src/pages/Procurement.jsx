import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import api from "@/lib/api";
import { PageHeader, Panel, StatusBadge, Currency, SectionTitle } from "@/components/kit";
import { DataTable } from "@/components/DataTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { formatDate } from "@/lib/format";
import { CheckCircle2, XCircle } from "lucide-react";

export default function Procurement() {
  return (
    <div>
      <PageHeader title="Procurement & AP/AR" subtitle="Vendors, purchase orders, goods receipts and three way invoice matching feed accounts payable." />
      <Tabs defaultValue="invoices">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices & Matching</TabsTrigger>
          <TabsTrigger value="po" data-testid="tab-po">Purchase Orders</TabsTrigger>
          <TabsTrigger value="grn" data-testid="tab-grn">Goods Receipts</TabsTrigger>
          <TabsTrigger value="vendors" data-testid="tab-vendors">Vendors</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices"><Invoices /></TabsContent>
        <TabsContent value="po"><POs /></TabsContent>
        <TabsContent value="grn"><GRN /></TabsContent>
        <TabsContent value="vendors"><Vendors /></TabsContent>
      </Tabs>
    </div>
  );
}

function Invoices() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [match, setMatch] = useState("");
  const [sel, setSel] = useState(null);
  const { data, loading } = useApi("/invoices", { page, q, match }, [page, q, match]);
  const open = async (row) => {
    const r = await api.get(`/invoices/${row.invoice_no}/match`);
    setSel(r.data);
  };
  return (
    <>
      <Tabs value={match || "all"} onValueChange={(v) => { setMatch(v === "all" ? "" : v); setPage(1); }} className="mb-4">
        <TabsList>
          <TabsTrigger value="all" data-testid="inv-filter-all">All invoices</TabsTrigger>
          <TabsTrigger value="matched" data-testid="inv-filter-matched">Matched</TabsTrigger>
          <TabsTrigger value="exception" data-testid="inv-filter-exception">Exceptions</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        testId="invoices-table"
        loading={loading}
        rows={data?.items || []}
        page={page} pages={data?.pages} total={data?.total} onPageChange={setPage}
        search={q} onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Search invoice, vendor or PO"
        onRowClick={open}
        columns={[
          { key: "invoice_no", header: "Invoice", render: (r) => <span className="num text-xs font-medium">{r.invoice_no}</span> },
          { key: "vendor_name", header: "Vendor", sortable: true },
          { key: "po_no", header: "PO", render: (r) => <span className="num text-xs">{r.po_no}</span> },
          { key: "amount", header: "Amount", align: "right", sortable: true, render: (r) => <Currency value={r.amount} /> },
          { key: "three_way_match", header: "3-Way Match", render: (r) => <StatusBadge status={r.three_way_match} /> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto scrollbar-thin" data-testid="match-sheet">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle className="num">{sel.invoice.invoice_no}</SheetTitle>
                <SheetDescription>Three way match: purchase order, goods receipt and supplier invoice.</SheetDescription>
              </SheetHeader>
              <div className="mt-5 space-y-2">
                {sel.checks.map((c, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{c.factor}</span>
                      {c.ok ? <CheckCircle2 className="h-4 w-4 text-positive" /> : <XCircle className="h-4 w-4 text-negative" />}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground num">
                      <div><span className="block text-[10px] uppercase">PO</span>{c.po}</div>
                      <div><span className="block text-[10px] uppercase">GRN</span>{c.grn}</div>
                      <div><span className="block text-[10px] uppercase">Invoice</span>{c.invoice}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${sel.result === "matched" ? "bg-positive-soft border-positive/20 text-positive" : "bg-negative-soft border-negative/20 text-negative"}`}>
                {sel.result === "matched" ? "All three documents match. Invoice cleared for payment." : `Match exception. ${sel.note}`}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function POs() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const { data, loading } = useApi("/purchase-orders", { page, q }, [page, q]);
  return (
    <DataTable
      testId="po-table"
      loading={loading}
      rows={data?.items || []}
      page={page} pages={data?.pages} total={data?.total} onPageChange={setPage}
      search={q} onSearch={(v) => { setQ(v); setPage(1); }}
      searchPlaceholder="Search PO or vendor"
      columns={[
        { key: "po_no", header: "PO", render: (r) => <span className="num text-xs font-medium">{r.po_no}</span> },
        { key: "vendor_name", header: "Vendor", sortable: true },
        { key: "department", header: "Dept" },
        { key: "item", header: "Item", className: "max-w-[160px] truncate" },
        { key: "quantity", header: "Qty", align: "right", render: (r) => <span className="num">{r.quantity}</span> },
        { key: "amount", header: "Amount", align: "right", sortable: true, render: (r) => <Currency value={r.amount} /> },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}

function GRN() {
  const [page, setPage] = useState(1);
  const { data, loading } = useApi("/grn", { page }, [page]);
  return (
    <DataTable
      testId="grn-table"
      loading={loading}
      rows={data?.items || []}
      page={page} pages={data?.pages} total={data?.total} onPageChange={setPage}
      columns={[
        { key: "grn_no", header: "GRN", render: (r) => <span className="num text-xs font-medium">{r.grn_no}</span> },
        { key: "po_no", header: "PO", render: (r) => <span className="num text-xs">{r.po_no}</span> },
        { key: "vendor_name", header: "Vendor" },
        { key: "ordered_qty", header: "Ordered", align: "right", render: (r) => <span className="num">{r.ordered_qty}</span> },
        { key: "received_qty", header: "Received", align: "right", render: (r) => <span className={`num ${r.received_qty < r.ordered_qty ? "text-warning font-semibold" : ""}`}>{r.received_qty}</span> },
        { key: "date", header: "Date", render: (r) => formatDate(r.date) },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}

function Vendors() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const { data, loading } = useApi("/vendors", { page, q }, [page, q]);
  const open = async (row) => {
    const r = await api.get(`/vendors/${row.vendor_code}/ledger`);
    setSel(r.data);
  };
  return (
    <>
      <DataTable
        testId="vendors-table"
        loading={loading}
        rows={data?.items || []}
        page={page} pages={data?.pages} total={data?.total} onPageChange={setPage}
        search={q} onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Search vendor"
        onRowClick={open}
        columns={[
          { key: "vendor_code", header: "Code", render: (r) => <span className="num text-xs">{r.vendor_code}</span> },
          { key: "name", header: "Vendor", sortable: true },
          { key: "category", header: "Category" },
          { key: "gstin", header: "GSTIN", render: (r) => <span className="num text-xs text-muted-foreground">{r.gstin}</span> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto scrollbar-thin" data-testid="vendor-ledger-sheet">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle>{sel.vendor.name}</SheetTitle>
                <SheetDescription>Vendor ledger with invoices and payments.</SheetDescription>
              </SheetHeader>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                <span className="text-sm text-muted-foreground">Outstanding balance</span>
                <Currency value={sel.outstanding} className="font-bold" />
              </div>
              <table className="w-full text-sm mt-4">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="text-left py-2">Ref</th>
                    <th className="text-right py-2">Debit</th>
                    <th className="text-right py-2">Credit</th>
                    <th className="text-right py-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {sel.entries.map((e, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-2">
                        <span className="num text-xs block">{e.ref}</span>
                        <span className="text-xs text-muted-foreground">{e.description}</span>
                      </td>
                      <td className="text-right num">{e.debit ? <Currency value={e.debit} /> : ""}</td>
                      <td className="text-right num">{e.credit ? <Currency value={e.credit} /> : ""}</td>
                      <td className="text-right num font-medium"><Currency value={e.balance} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
