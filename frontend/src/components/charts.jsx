import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatINRCompact } from "@/lib/format";

const AXIS = "hsl(var(--muted-foreground))";
const GRID = "hsl(var(--border))";
export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--info))",
];

function TipBox({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 num">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.color || p.fill }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">
            {formatINRCompact(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrendArea({ data, keys }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <defs>
          {keys.map((k, i) => (
            <linearGradient key={k.key} id={`g-${k.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS[i]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_COLORS[i]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="period" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke={AXIS}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatINRCompact(v).replace("\u20B9", "")}
          width={54}
        />
        <Tooltip content={<TipBox />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k, i) => (
          <Area
            key={k.key}
            type="monotone"
            dataKey={k.key}
            name={k.name}
            stroke={CHART_COLORS[i]}
            strokeWidth={2}
            fill={`url(#g-${k.key})`}
            animationDuration={900}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({ data, keys }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="period" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke={AXIS}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatINRCompact(v).replace("\u20B9", "")}
          width={54}
        />
        <Tooltip content={<TipBox />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k, i) => (
          <Line
            key={k.key}
            type="monotone"
            dataKey={k.key}
            name={k.name}
            stroke={k.color || CHART_COLORS[i]}
            strokeWidth={2}
            strokeDasharray={k.dashed ? "5 4" : undefined}
            dot={false}
            animationDuration={900}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarSeries({ data, keys, layout = "horizontal", height = 260 }) {
  const vertical = layout === "vertical";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={{ left: vertical ? 40 : -10, right: 8, top: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={!vertical} horizontal={vertical} />
        {vertical ? (
          <>
            <XAxis type="number" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatINRCompact(v).replace("\u20B9", "")} />
            <YAxis type="category" dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={90} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatINRCompact(v).replace("\u20B9", "")} width={54} />
          </>
        )}
        <Tooltip content={<TipBox />} cursor={{ fill: "hsl(var(--accent))", opacity: 0.4 }} />
        {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {keys.map((k, i) => (
          <Bar
            key={k.key}
            dataKey={k.key}
            name={k.name}
            fill={CHART_COLORS[i]}
            radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            animationDuration={800}
            barSize={vertical ? 14 : 26}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={58}
          outerRadius={92}
          paddingAngle={2}
          animationDuration={800}
        >
          {data.map((_, i) => (
            <Cell key={i} stroke="transparent" fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<TipBox />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
