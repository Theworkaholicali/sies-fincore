import { cn } from "@/lib/utils";
import { formatINR, formatINRCompact, formatPct } from "@/lib/format";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";

// Section + page headers -----------------------------------------------------
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Panel({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Animated count-up currency -------------------------------------------------
export function useCountUp(target, duration = 700) {
  const [val, setVal] = useState(0);
  const ref = useRef();
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    cancelAnimationFrame(ref.current);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * eased);
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);
  return val;
}

export function Currency({ value, compact = false, className }) {
  return (
    <span className={cn("num", className)}>
      {compact ? formatINRCompact(value) : formatINR(value)}
    </span>
  );
}

// KPI card -------------------------------------------------------------------
export function KpiCard({ label, value, delta, deltaLabel, compact = true,
  status, spark, onClick, testId }) {
  const animated = useCountUp(value || 0);
  const positive = delta != null && delta >= 0;
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "group text-left rounded-xl border border-border bg-card p-5 shadow-sm w-full",
        "transition-all duration-200 hover:border-brand/50 hover:shadow-md",
        onClick && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          {label}
        </span>
        {status && <StatusDot status={status} />}
      </div>
      <div className="mt-3 num text-2xl lg:text-[1.7rem] font-bold text-foreground">
        {compact ? formatINRCompact(animated) : formatINR(animated)}
      </div>
      {delta != null && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold num",
              positive ? "text-positive" : "text-negative"
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {formatPct(Math.abs(delta))}
          </span>
          <span className="text-muted-foreground">{deltaLabel}</span>
        </div>
      )}
      {spark}
    </button>
  );
}

function StatusDot({ status }) {
  const map = {
    positive: "bg-positive",
    warning: "bg-warning",
    critical: "bg-negative",
    neutral: "bg-muted-foreground",
  };
  return <span className={cn("h-2 w-2 rounded-full", map[status] || map.neutral)} />;
}

// Status badge (color + icon + text) ----------------------------------------
const STATUS_STYLES = {
  positive: { icon: CheckCircle2, cls: "text-positive bg-positive-soft border-positive/20" },
  warning: { icon: Clock, cls: "text-warning bg-warning/10 border-warning/20" },
  critical: { icon: XCircle, cls: "text-negative bg-negative-soft border-negative/20" },
  info: { icon: Info, cls: "text-info bg-info/10 border-info/20" },
  neutral: { icon: AlertTriangle, cls: "text-muted-foreground bg-muted border-border" },
};

const STATUS_MAP = {
  paid: "positive", success: "positive", matched: "positive", approved: "positive",
  reconciled: "positive", in_use: "positive", active: "positive", normal: "positive",
  received: "positive", closed: "positive",
  partial: "warning", pending: "warning", monitor: "warning", due_soon: "warning",
  on_hold: "warning", requires_review: "warning", warning: "warning",
  unpaid: "critical", exception: "critical", overdue: "critical", critical: "critical",
  exceeded: "critical",
};

export function StatusBadge({ status, label }) {
  const kind = STATUS_MAP[status] || (["positive", "warning", "critical", "info"].includes(status) ? status : "neutral");
  const { icon: Icon, cls } = STATUS_STYLES[kind] || STATUS_STYLES.neutral;
  const text = (label || status || "").toString().replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium capitalize whitespace-nowrap",
        cls
      )}
    >
      <Icon className="h-3 w-3" />
      {text}
    </span>
  );
}

// Empty state ----------------------------------------------------------------
export function EmptyState({ title, message, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="mb-3 rounded-full bg-muted p-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {message && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{message}</p>}
    </div>
  );
}

// Skeleton -------------------------------------------------------------------
export function SkeletonBlock({ className }) {
  return <div className={cn("fc-shimmer rounded-md h-4", className)} />;
}

export function KpiSkeletonGrid({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5">
          <SkeletonBlock className="w-24 h-3" />
          <SkeletonBlock className="w-32 h-7 mt-4" />
          <SkeletonBlock className="w-20 h-3 mt-3" />
        </div>
      ))}
    </div>
  );
}
