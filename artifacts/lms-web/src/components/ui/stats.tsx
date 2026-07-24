import * as React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1 shared KPI / metric primitives — brand-consistent (violet→cyan),
 * dependency-free (inline SVG), theme-aware via design tokens.
 *
 * Components: <Sparkline>, <ProgressRing>, <TrendDelta>, <StatTile>, <StatusPill>.
 */

// ─── Sparkline ────────────────────────────────────────────────────────────────
// Tiny inline area+line chart for showing a metric's recent trend.
export function Sparkline({
  data,
  width = 120,
  height = 36,
  className,
  stroke = 'hsl(var(--primary))',
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
}) {
  const id = React.useId();
  if (!data || data.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden="true" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const stepX = (width - pad * 2) / (data.length - 1);
  const points = data.map((d, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (d - min) / range);
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${height} L${points[0][0].toFixed(1)},${height} Z`;
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.6" fill={stroke} />
    </svg>
  );
}

// ─── ProgressRing ─────────────────────────────────────────────────────────────
// Circular progress indicator with gradient stroke and centered label.
export function ProgressRing({
  value,
  size = 72,
  strokeWidth = 8,
  label,
  className,
}: {
  value: number; // 0–100
  size?: number;
  strokeWidth?: number;
  label?: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);
  return (
    <div className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#ring-${id})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--secondary))" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        {label ?? <span className="text-sm font-bold tabular-nums">{Math.round(clamped)}%</span>}
      </div>
    </div>
  );
}

// ─── TrendDelta ───────────────────────────────────────────────────────────────
// Coloured up/down/flat change indicator.
export function TrendDelta({ value, suffix = '%', className }: { value: number; suffix?: string; className?: string }) {
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  const color = dir === 'up' ? 'text-success' : dir === 'down' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold tabular-nums', color, className)}>
      <Icon className="w-3.5 h-3.5" />
      {value > 0 ? '+' : ''}{value}{suffix}
    </span>
  );
}

// ─── StatTile ─────────────────────────────────────────────────────────────────
// The single KPI-card primitive used across all dashboards.
export function StatTile({
  label,
  value,
  icon: Icon,
  accent = 'primary',
  trend,
  spark,
  ring,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent?: 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive';
  trend?: number;
  spark?: number[];
  ring?: number;
  hint?: string;
  className?: string;
}) {
  const accentVar = `hsl(var(--${accent}))`;
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm',
        'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/40',
        className,
      )}
    >
      {/* accent glow wash */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-25"
        style={{ background: accentVar }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-foreground">{value}</div>
          {(trend !== undefined || hint) && (
            <div className="mt-2 flex items-center gap-2">
              {trend !== undefined && <TrendDelta value={trend} />}
              {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
            </div>
          )}
        </div>
        {ring !== undefined ? (
          <ProgressRing value={ring} size={54} strokeWidth={6} />
        ) : Icon ? (
          <div
            className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-border/60"
            style={{ background: `color-mix(in srgb, ${accentVar} 12%, transparent)` }}
          >
            <Icon className="h-5 w-5" style={{ color: accentVar }} />
          </div>
        ) : null}
      </div>
      {spark && spark.length > 1 && (
        <div className="mt-3 -mb-1">
          <Sparkline data={spark} width={220} height={34} stroke={accentVar} className="w-full" />
        </div>
      )}
    </div>
  );
}

// ─── StatusPill ───────────────────────────────────────────────────────────────
// Unified colour-coded status indicator (Pending / Approved / Rejected / …).
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/30',
  pending_review: 'bg-warning/10 text-warning border-warning/30',
  approved: 'bg-success/10 text-success border-success/30',
  completed: 'bg-success/10 text-success border-success/30',
  published: 'bg-success/10 text-success border-success/30',
  available: 'bg-success/10 text-success border-success/30',
  paid: 'bg-info/10 text-info border-info/30',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
  failed: 'bg-destructive/10 text-destructive border-destructive/30',
  draft: 'bg-muted text-muted-foreground border-border',
  default: 'bg-muted text-muted-foreground border-border',
};
const STATUS_DOT: Record<string, string> = {
  pending: 'bg-warning',
  pending_review: 'bg-warning',
  approved: 'bg-success',
  completed: 'bg-success',
  published: 'bg-success',
  available: 'bg-success',
  paid: 'bg-info',
  rejected: 'bg-destructive',
  failed: 'bg-destructive',
  draft: 'bg-muted-foreground',
  default: 'bg-muted-foreground',
};

export function StatusPill({
  status,
  label,
  className,
  pulse,
}: {
  status: string;
  label?: string;
  className?: string;
  pulse?: boolean;
}) {
  const key = (status || 'default').toLowerCase();
  const style = STATUS_STYLES[key] || STATUS_STYLES.default;
  const dot = STATUS_DOT[key] || STATUS_DOT.default;
  const text = label ?? status.replace(/_/g, ' ');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize',
        style,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dot, pulse && 'animate-pulse')} />
      {text}
    </span>
  );
}
