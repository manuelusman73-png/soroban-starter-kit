import React, { useState, useMemo } from 'react';
import { useAnalytics } from '../context/AnalyticsContext';
import type {
  ReportDefinition, ReportColumn, ReportFilter, ChartType,
  DataSourceType, AggregationFn, FilterOperator, ExportFormat, ScheduleFrequency,
} from '../services/analytics/types';

// ─── Shared primitives ────────────────────────────────────────────────────────

const CHART_ICONS: Record<ChartType, string> = { bar: '📊', line: '📈', area: '🏔', pie: '🥧', table: '📋', kpi: '🎯' };
const SEV_COLOR: Record<string, string> = { positive: 'var(--color-success)', warning: 'var(--color-warning)', info: 'var(--color-text-muted)' };
const CAT_COLOR: Record<string, string> = { trend: '#4fc3f7', anomaly: 'var(--color-warning)', opportunity: 'var(--color-success)', risk: 'var(--color-error)' };

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: color + '22', color, border: `1px solid ${color}44`, textTransform: 'capitalize' }}>
      {label}
    </span>
  );
}

function Btn({ children, onClick, variant = 'default', disabled, small }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: 'default' | 'danger' | 'success' | 'warning'; disabled?: boolean; small?: boolean;
}) {
  const col = { default: 'var(--color-text-primary)', danger: 'var(--color-error)', success: 'var(--color-success)', warning: 'var(--color-warning)' }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? '3px 10px' : '6px 14px', fontSize: small ? 11 : 13,
      background: col + '18', color: col, border: `1px solid ${col}44`,
      borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    }}>
      {children}
    </button>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '7px 10px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }}
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '7px 10px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 4, fontSize: 13 }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function timeAgo(ts: number) {
  const d = Date.now() - ts;
  if (d < 60000) return 'just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

// ─── Mini SVG bar chart ───────────────────────────────────────────────────────

function MiniBarChart({ data, labelKey, valueKey, color = 'var(--color-highlight)' }: {
  data: Record<string, any>[]; labelKey: string; valueKey: string; color?: string;
}) {
  if (!data.length) return <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>No data</p>;
  const max = Math.max(...data.map(r => Number(r[valueKey] ?? 0)), 1);
  const w = 400; const h = 120; const bw = Math.max(8, (w / data.length) * 0.6);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: 'block' }} aria-label="Bar chart">
      {data.map((row, i) => {
        const x = (i / data.length) * w + bw / 2;
        const val = Number(row[valueKey] ?? 0);
        const bh = Math.max(2, (val / max) * (h - 24));
        return (
          <g key={i}>
            <rect x={x - bw / 2} y={h - bh - 16} width={bw} height={bh} rx="3" fill={color} opacity="0.85">
              <title>{row[labelKey]}: {val}</title>
            </rect>
            <text x={x} y={h - 2} textAnchor="middle" fill="var(--color-text-muted)" fontSize="9" style={{ overflow: 'hidden' }}>
              {String(row[labelKey] ?? '').slice(0, 8)}
            </text>
            <text x={x} y={h - bh - 20} textAnchor="middle" fill="var(--color-text-primary)" fontSize="9">{val}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Mini SVG pie chart ───────────────────────────────────────────────────────

const PIE_COLORS = ['#e94560', '#00d26a', '#ffc107', '#4fc3f7', '#ce93d8', '#ffb74d'];

function MiniPieChart({ data, labelKey, valueKey }: { data: Record<string, any>[]; labelKey: string; valueKey: string }) {
  const total = data.reduce((s, r) => s + Number(r[valueKey] ?? 0), 0);
  if (!total) return <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>No data</p>;
  const cx = 80; const cy = 80; const r = 60;
  let angle = -Math.PI / 2;
  const slices = data.map((row, i) => {
    const pct = Number(row[valueKey] ?? 0) / total;
    const a = pct * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle); const y1 = cy + r * Math.sin(angle);
    angle += a;
    const x2 = cx + r * Math.cos(angle); const y2 = cy + r * Math.sin(angle);
    return { d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${a > Math.PI ? 1 : 0},1 ${x2},${y2} Z`, color: PIE_COLORS[i % PIE_COLORS.length], label: row[labelKey], pct: (pct * 100).toFixed(1) };
  });
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 160 160" width={160} height={160} aria-label="Pie chart">
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} opacity={0.9}><title>{s.label}: {s.pct}%</title></path>)}
        <circle cx={cx} cy={cy} r={r * 0.45} fill="var(--color-bg-secondary)" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: 'inline-block', flexShrink: 0 }} />
            <span>{s.label}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
