import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useApi } from "@/hooks/useApi";
import { PageHeader, Panel, SectionTitle, Currency } from "@/components/kit";
import { TrendLine } from "@/components/charts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatINRCompact } from "@/lib/format";

export default function Analytics() {
  const { fy } = useOutletContext();
  return (
    <div>
      <PageHeader title="Intelligence & Analytics" subtitle="Institutional financial ratios and statistical forecasts derived from verified data." />
      <Tabs defaultValue="kpi">
        <TabsList className="mb-4">
          <TabsTrigger value="kpi" data-testid="tab-kpi">KPI Engine</TabsTrigger>
          <TabsTrigger value="forecast" data-testid="tab-forecast">Forecasting</TabsTrigger>
        </TabsList>
        <TabsContent value="kpi"><Kpis fy={fy} /></TabsContent>
        <TabsContent value="forecast"><Forecast fy={fy} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Kpis({ fy }) {
  const { data } = useApi("/analytics/kpis", { fy }, [fy]);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {(data?.kpis || []).map((k) => {
        const isPct = k.unit === "%";
        const isMoney = k.unit === "INR";
        const val = isMoney ? formatINRCompact(k.value) : isPct ? `${k.value}%` : `${k.value}${k.unit === "x" ? "x" : ""}`;
        let tone = "text-foreground";
        if (k.critical != null && k.warning != null) {
          const bad = k.higher_better ? k.value <= k.critical : k.value >= k.critical;
          const warn = k.higher_better ? k.value <= k.warning : k.value >= k.warning;
          tone = bad ? "text-negative" : warn ? "text-warning" : "text-positive";
        }
        return (
          <Panel key={k.name} data-testid={`kpi-${k.name.toLowerCase().replace(/ /g, "-")}`}>
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{k.name}</p>
            <p className={cn("num text-3xl font-bold mt-3", tone)}>{val}</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{k.desc}</p>
          </Panel>
        );
      })}
    </div>
  );
}

function Forecast({ fy }) {
  const [metric, setMetric] = useState("revenue");
  const { data } = useApi("/analytics/forecast", { metric, fy }, [metric, fy]);
  const combined = [
    ...(data?.historical || []),
    ...(data?.projected || []),
  ].map((d) => ({
    period: d.period,
    Historical: d.type === "historical" ? d.value : null,
    Projected: d.type === "projected" ? d.value : null,
  }));
  // bridge the two series at the join
  if (data?.historical?.length && data?.projected?.length) {
    const joinIdx = data.historical.length - 1;
    if (combined[joinIdx]) combined[joinIdx].Projected = combined[joinIdx].Historical;
  }
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {["revenue", "expense", "inflow"].map((m) => (
          <button
            key={m}
            data-testid={`forecast-metric-${m}`}
            onClick={() => setMetric(m)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              metric === m ? "border-brand bg-brand/10 text-brand" : "border-border hover:bg-accent"
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <Panel>
        <SectionTitle right={<span className="text-xs text-muted-foreground">{data?.method}</span>}>
          {metric} forecast
        </SectionTitle>
        <TrendLine
          data={combined}
          keys={[
            { key: "Historical", name: "Historical" },
            { key: "Projected", name: "Projected", color: "hsl(var(--brand))", dashed: true },
          ]}
        />
        <p className="text-xs text-muted-foreground mt-3">
          Projected values are statistical estimates and are not guaranteed outcomes.
        </p>
      </Panel>
    </div>
  );
}
