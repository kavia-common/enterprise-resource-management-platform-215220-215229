import React, { useEffect, useMemo, useState } from 'react';
import { getReports, exportReportsCsvAsBlob } from '../api/reports';

/**
 * Reports page provides a simple overview:
 * - KPI cards for aggregated counts (summary)
 * - Minimal trend view (table with an inline chart-like bar)
 * - CSV export button
 * Includes loading, error and empty states.
 */

// Simple inline styles reusing theme variables
const cardStyle = {
  padding: 14,
  borderRadius: 12,
  background: 'var(--color-surface)',
  border: '1px solid rgba(17,24,39,0.08)',
  boxShadow: 'var(--shadow-sm)',
};

function KpiCard({ label, value }) {
  return (
    <div style={cardStyle}>
      <div className="subtle" style={{ fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{value ?? '-'}</div>
    </div>
  );
}

function TrendRow({ label, value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <tr style={{ borderTop: '1px solid rgba(17,24,39,0.06)' }}>
      <td style={{ padding: 10, fontWeight: 600 }}>{label}</td>
      <td style={{ padding: 10 }}>{value}</td>
      <td style={{ padding: 10 }}>
        <div style={{ height: 10, background: 'rgba(37,99,235,0.08)', borderRadius: 999, overflow: 'hidden' }}>
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, rgba(37,99,235,0.7), rgba(37,99,235,1))',
              transition: 'width .3s ease',
            }}
            aria-label={`${pct}%`}
          />
        </div>
      </td>
    </tr>
  );
}

// PUBLIC_INTERFACE
export default function ReportsPage() {
  /**
   * Fetches data from /api/reports (or /api/reports/summary fallback)
   * Renders KPI cards and a simple trend table.
   * CSV export uses a blob fetch to include auth header, then triggers a download.
   */
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setErr('');
      try {
        const data = await getReports();
        if (!mounted) return;
        setSummary(data?.summary || null);
        setTrends(Array.isArray(data?.trends) ? data.trends : []);
      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || 'Failed to load reports');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const kpis = useMemo(() => {
    const s = summary || {};
    // Order and labels
    return [
      { key: 'total_projects', label: 'Total Projects', value: s.total_projects },
      { key: 'total_tasks', label: 'Total Tasks', value: s.total_tasks },
      { key: 'open_tasks', label: 'Open Tasks', value: s.open_tasks },
      { key: 'in_progress_tasks', label: 'In Progress Tasks', value: s.in_progress_tasks },
      { key: 'done_tasks', label: 'Done Tasks', value: s.done_tasks },
      { key: 'total_resources', label: 'Total Resources', value: s.total_resources },
      { key: 'pending_approvals', label: 'Pending Approvals', value: s.pending_approvals },
    ].filter(Boolean);
  }, [summary]);

  const normalizedTrends = useMemo(() => {
    // Expect trends to be an array of { label, value } or { date, count }.
    // Normalize to { label, value } for display.
    const rows = (trends || []).map((t) => {
      if (typeof t === 'number') return { label: String(t), value: t };
      const label = t.label ?? t.date ?? t.name ?? '-';
      const value = Number(t.value ?? t.count ?? 0);
      return { label, value };
    });
    return rows;
  }, [trends]);

  const maxTrendValue = useMemo(() => {
    return normalizedTrends.reduce((m, r) => Math.max(m, r.value || 0), 0);
  }, [normalizedTrends]);

  async function onExportCsv() {
    try {
      const blob = await exportReportsCsvAsBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `reports-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.message || 'Export failed');
    }
  }

  return (
    <main className="main-content" id="main-content">
      <div className="page-header">
        <div>
          <h1 className="h1">Reports</h1>
          <div className="subtle">High-level KPIs and trends</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={() => window.location.reload()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="btn" onClick={onExportCsv}>Export CSV</button>
        </div>
      </div>

      {err ? (
        <div
          role="alert"
          className="surface"
          style={{
            padding: 12,
            border: '1px solid rgba(239,68,68,0.25)',
            background: 'rgba(239,68,68,0.06)',
            color: 'var(--color-error)',
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      ) : null}

      <section className="surface" style={{ padding: 12, marginBottom: 12 }}>
        <div className="subtle" style={{ marginBottom: 8 }}>Key Performance Indicators</div>
        {loading ? (
          <div className="subtle">Loading KPIs…</div>
        ) : !kpis.length ? (
          <div className="subtle">No summary data available.</div>
        ) : (
          <div className="grid cols-3">
            {kpis.map((k) => (
              <KpiCard key={k.key} label={k.label} value={k.value} />
            ))}
          </div>
        )}
      </section>

      <section className="surface" style={{ padding: 0, overflowX: 'auto' }}>
        <header style={{ padding: 12, borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
          <div className="h1" style={{ margin: 0, fontSize: 16 }}>Trends</div>
        </header>
        {loading ? (
          <div style={{ padding: 12 }} className="subtle">Loading trends…</div>
        ) : normalizedTrends.length === 0 ? (
          <div style={{ padding: 12 }} className="subtle">No trend data.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: 'rgba(17,24,39,0.02)' }}>
                <th style={{ padding: 10, color: 'var(--color-text-muted)', fontWeight: 700 }}>Label</th>
                <th style={{ padding: 10, color: 'var(--color-text-muted)', fontWeight: 700 }}>Value</th>
                <th style={{ padding: 10, color: 'var(--color-text-muted)', fontWeight: 700, width: 300 }}>Chart</th>
              </tr>
            </thead>
            <tbody>
              {normalizedTrends.map((row, idx) => (
                <TrendRow key={`${row.label}-${idx}`} label={row.label} value={row.value} max={maxTrendValue} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
