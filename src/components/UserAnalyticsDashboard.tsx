import React, { useState, useEffect, useCallback } from 'react';
import {
  userAnalyticsService,
  type AnalyticsOverview,
  type FeatureAdoption,
  type JourneyStep,
  type ABTest,
  type CohortData,
  type UXInsight,
  type UserSegment,
} from '../services/analytics/userAnalyticsService';

type Tab = 'overview' | 'journey' | 'adoption' | 'abtests' | 'cohorts' | 'segments' | 'insights';

// ─── Style helpers ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '16px',
  borderRadius: '6px',
  marginBottom: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

const metricCard: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '16px',
  borderRadius: '6px',
  textAlign: 'center',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: active ? '#4f46e5' : '#e9ecef',
    color: active ? 'white' : '#333',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
  };
}

function badge(color: string): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    backgroundColor: color,
    color: 'white',
    fontSize: '11px',
    marginLeft: '6px',
  };
}

function progressBar(value: number, color = '#4f46e5'): React.ReactElement {
  return (
    <div style={{ backgroundColor: '#e9ecef', borderRadius: '4px', height: '8px', width: '100%' }}>
      <div
        style={{
          width: `${Math.min(100, value * 100).toFixed(1)}%`,
          backgroundColor: color,
          borderRadius: '4px',
          height: '100%',
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}min`;
}

function fmtDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString();
}

const SEGMENT_COLORS: Record<UserSegment, string> = {
  new: '#6c757d',
  casual: '#17a2b8',
  regular: '#ffc107',
  power: '#28a745',
};

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function OverviewTab({ overview }: { overview: AnalyticsOverview }): React.ReactElement {
  return (
    <div>
      {/* Consent banner (privacy-compliant) */}
      <div style={{ ...card, backgroundColor: '#eef2ff', border: '1px solid #c7d2fe' }}>
        <strong style={{ color: '#4f46e5' }}>Privacy Notice</strong>
        <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#374151' }}>
          Analytics are collected only with explicit user consent. No personally identifiable
          information (PII) is stored. All identifiers are anonymized session tokens that expire
          after 30 days. Use the consent controls in Settings to manage your preferences.
        </p>
      </div>

      {/* Key metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Total Sessions', value: overview.totalSessions.toLocaleString() },
          { label: 'Active Sessions', value: overview.activeSessions.toLocaleString() },
          { label: 'Avg Duration', value: fmtDuration(overview.avgSessionDuration) },
          { label: 'Total Events', value: overview.totalEvents.toLocaleString() },
          { label: 'Events (24h)', value: overview.eventsLast24h.toLocaleString() },
          { label: 'Engagement Rate', value: `${(overview.engagementRate * 100).toFixed(1)}%` },
        ].map(({ label, value }) => (
          <div key={label} style={metricCard}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Top features */}
      <div style={card}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Top Features (by interactions)</h3>
        {overview.topFeatures.map((f, i) => {
          const max = overview.topFeatures[0]?.interactions ?? 1;
          return (
            <div key={f.feature} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                <span>{i + 1}. {f.feature}</span>
                <span style={{ fontWeight: 600 }}>{f.interactions}</span>
              </div>
              {progressBar(f.interactions / max)}
            </div>
          );
        })}
      </div>

      {/* Segment breakdown */}
      <div style={card}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>User Segment Breakdown</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {(Object.entries(overview.segmentBreakdown) as [UserSegment, number][]).map(([seg, count]) => (
            <div key={seg} style={{ ...metricCard, borderTop: `3px solid ${SEGMENT_COLORS[seg]}` }}>
              <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'capitalize', marginBottom: '4px' }}>
                {seg}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{count}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                {overview.totalSessions > 0
                  ? `${((count / overview.totalSessions) * 100).toFixed(0)}%`
                  : '0%'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function JourneyTab({ steps }: { steps: JourneyStep[] }): React.ReactElement {
  const maxCount = Math.max(...steps.map((s) => s.count), 1);

  return (
    <div style={card}>
      <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600 }}>User Journey — Feature Flow</h3>
      <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#6b7280' }}>
        Shows which features users visit most, ordered by engagement volume, with drop-off rates between steps.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {steps.map((step, i) => (
          <div key={step.feature}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Step number */}
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                backgroundColor: '#4f46e5', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, flexShrink: 0,
              }}>
                {i + 1}
              </div>

              {/* Bar */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <strong>{step.feature}</strong>
                  <span>{step.count} sessions</span>
                </div>
                {progressBar(step.count / maxCount)}
              </div>
            </div>

            {/* Drop-off indicator */}
            {i < steps.length - 1 && step.dropOffRate > 0.05 && (
              <div style={{
                marginLeft: '40px', marginTop: '6px',
                fontSize: '11px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <span>▼</span>
                <span>{(step.dropOffRate * 100).toFixed(0)}% drop-off to next feature</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdoptionTab({ adoption }: { adoption: FeatureAdoption[] }): React.ReactElement {
  const trendIcon = (t: FeatureAdoption['trend']) =>
    t === 'up' ? '↑' : t === 'down' ? '↓' : '→';
  const trendColor = (t: FeatureAdoption['trend']) =>
    t === 'up' ? '#16a34a' : t === 'down' ? '#dc2626' : '#6b7280';

  return (
    <div style={card}>
      <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600 }}>Feature Adoption</h3>
      <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#6b7280' }}>
        Adoption rate = unique sessions that used a feature ÷ total sessions. Trend is week-over-week.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600 }}>Feature</th>
            <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>Adoption</th>
            <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>Interactions</th>
            <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>Sessions</th>
            <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>Trend</th>
            <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>Last Used</th>
          </tr>
        </thead>
        <tbody>
          {adoption.map((f) => (
            <tr key={f.feature} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '10px 6px', fontWeight: 500 }}>{f.feature}</td>
              <td style={{ padding: '10px 6px' }}>
                <div style={{ textAlign: 'right', marginBottom: '4px' }}>
                  {(f.adoptionRate * 100).toFixed(1)}%
                </div>
                {progressBar(f.adoptionRate, f.adoptionRate > 0.5 ? '#16a34a' : f.adoptionRate > 0.2 ? '#f59e0b' : '#ef4444')}
              </td>
              <td style={{ padding: '10px 6px', textAlign: 'right' }}>{f.totalInteractions}</td>
              <td style={{ padding: '10px 6px', textAlign: 'right' }}>{f.uniqueSessions}</td>
              <td style={{ padding: '10px 6px', textAlign: 'right', color: trendColor(f.trend), fontWeight: 600 }}>
                {trendIcon(f.trend)} {f.trend}
              </td>
              <td style={{ padding: '10px 6px', textAlign: 'right', color: '#6b7280' }}>{fmtDate(f.lastUsed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ABTestsTab({ tests }: { tests: ABTest[] }): React.ReactElement {
  return (
    <div>
      {tests.map((test) => (
        <div key={test.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{test.name}</h3>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                Started {fmtDate(test.startTime)}
                {test.endTime && ` · Ended ${fmtDate(test.endTime)}`}
              </div>
            </div>
            <span style={badge(test.status === 'active' ? '#16a34a' : test.status === 'concluded' ? '#6b7280' : '#f59e0b')}>
              {test.status}
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '6px', fontWeight: 600 }}>Variant</th>
                <th style={{ textAlign: 'right', padding: '6px', fontWeight: 600 }}>Sessions</th>
                <th style={{ textAlign: 'right', padding: '6px', fontWeight: 600 }}>Conversions</th>
                <th style={{ textAlign: 'right', padding: '6px', fontWeight: 600 }}>Rate</th>
                <th style={{ textAlign: 'right', padding: '6px', fontWeight: 600 }}>Uplift</th>
              </tr>
            </thead>
            <tbody>
              {test.variants.map((v) => (
                <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 6px', fontWeight: v.id === 'control' ? 400 : 600 }}>
                    {v.name}
                    {v.id === 'control' && <span style={badge('#6b7280')}>control</span>}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{v.sessions.toLocaleString()}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{v.conversions.toLocaleString()}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>
                    {(v.conversionRate * 100).toFixed(1)}%
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                    {v.uplift !== undefined ? (
                      <span style={{ color: v.uplift > 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                        {v.uplift > 0 ? '+' : ''}{(v.uplift * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span style={{ color: '#6b7280' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Conversion rate bars */}
          <div style={{ marginTop: '12px' }}>
            {test.variants.map((v) => (
              <div key={v.id} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span>{v.name}</span>
                  <span>{(v.conversionRate * 100).toFixed(1)}%</span>
                </div>
                {progressBar(v.conversionRate, v.id === 'control' ? '#6b7280' : '#4f46e5')}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CohortsTab({ cohorts }: { cohorts: CohortData[] }): React.ReactElement {
  const maxWeeks = Math.max(...cohorts.map((c) => c.retention.length));

  function retentionColor(pct: number): string {
    if (pct >= 70) return '#dcfce7';
    if (pct >= 50) return '#d1fae5';
    if (pct >= 30) return '#fef9c3';
    if (pct >= 15) return '#fee2e2';
    return '#fecaca';
  }

  return (
    <div style={card}>
      <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600 }}>Cohort Retention Analysis</h3>
      <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#6b7280' }}>
        Each row is a weekly cohort. Columns show % of that cohort still active in subsequent weeks.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>Cohort Week</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>Users</th>
              {Array.from({ length: maxWeeks }, (_, i) => (
                <th key={i} style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 600 }}>
                  Wk {i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => (
              <tr key={cohort.cohortWeek} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px 6px', fontWeight: 500, whiteSpace: 'nowrap' }}>{cohort.cohortWeek}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{cohort.startSize}</td>
                {Array.from({ length: maxWeeks }, (_, i) => {
                  const pct = cohort.retention[i];
                  return (
                    <td
                      key={i}
                      style={{
                        padding: '8px 6px',
                        textAlign: 'center',
                        backgroundColor: pct !== undefined ? retentionColor(pct) : 'transparent',
                        fontWeight: i === 0 ? 700 : 400,
                      }}
                    >
                      {pct !== undefined ? `${pct}%` : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
        {[
          { color: '#dcfce7', label: '≥70%' },
          { color: '#fef9c3', label: '30–69%' },
          { color: '#fee2e2', label: '<30%' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: color, borderRadius: '2px' }} />
            <span style={{ color: '#6b7280' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SegmentsTab({
  segments,
}: {
  segments: ReturnType<typeof userAnalyticsService.getSegmentDetails>;
}): React.ReactElement {
  const SEGMENT_LABELS: Record<UserSegment, string> = {
    new: 'New Users',
    casual: 'Casual Users',
    regular: 'Regular Users',
    power: 'Power Users',
  };
  const SEGMENT_DESC: Record<UserSegment, string> = {
    new: 'First session, 0 events',
    casual: '1–4 events per session',
    regular: '5–14 events per session',
    power: '15+ events per session',
  };

  return (
    <div>
      {segments.map((seg) => (
        <div
          key={seg.segment}
          style={{ ...card, borderLeft: `4px solid ${SEGMENT_COLORS[seg.segment]}` }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: 600 }}>
                {SEGMENT_LABELS[seg.segment]}
                <span style={badge(SEGMENT_COLORS[seg.segment])}>{seg.count} sessions</span>
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{SEGMENT_DESC[seg.segment]}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginTop: '12px' }}>
            {[
              { label: 'Avg Events/Session', value: seg.avgEvents.toFixed(1) },
              { label: 'Avg Session Duration', value: fmtDuration(seg.avgDuration) },
              { label: 'Top Feature', value: seg.topFeature },
              { label: 'Conversion Rate', value: `${(seg.conversionRate * 100).toFixed(1)}%` },
            ].map(({ label, value }) => (
              <div key={label} style={{ backgroundColor: '#f9fafb', padding: '10px', borderRadius: '4px' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightsTab({ insights }: { insights: UXInsight[] }): React.ReactElement {
  const typeStyle: Record<UXInsight['type'], { bg: string; border: string }> = {
    opportunity: { bg: '#eff6ff', border: '#3b82f6' },
    warning: { bg: '#fff7ed', border: '#f97316' },
    success: { bg: '#f0fdf4', border: '#22c55e' },
  };
  const impactColor: Record<UXInsight['impact'], string> = {
    high: '#dc2626',
    medium: '#d97706',
    low: '#16a34a',
  };

  if (insights.length === 0) {
    return (
      <div style={{ ...card, textAlign: 'center', color: '#6b7280', padding: '40px' }}>
        No insights generated yet. Track more user events to surface actionable recommendations.
      </div>
    );
  }

  return (
    <div>
      <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
        Automatically surfaced from behavioral patterns. Ordered by impact.
      </p>
      {insights
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.impact] - order[b.impact];
        })
        .map((insight) => (
          <div
            key={insight.id}
            style={{
              ...card,
              backgroundColor: typeStyle[insight.type].bg,
              borderLeft: `4px solid ${typeStyle[insight.type].border}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{insight.title}</h3>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={badge(impactColor[insight.impact])}>{insight.impact} impact</span>
                <span style={badge(typeStyle[insight.type].border)}>{insight.type}</span>
              </div>
            </div>
            <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#374151' }}>{insight.description}</p>
            <div style={{ fontSize: '13px', color: '#1d4ed8', fontWeight: 500 }}>
              Recommendation: {insight.recommendation}
            </div>
            {insight.relatedFeature && (
              <div style={{ marginTop: '6px', fontSize: '11px', color: '#6b7280' }}>
                Feature: {insight.relatedFeature}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function UserAnalyticsDashboard(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [adoption, setAdoption] = useState<FeatureAdoption[]>([]);
  const [journey, setJourney] = useState<JourneyStep[]>([]);
  const [abTests, setABTests] = useState<ABTest[]>([]);
  const [cohorts, setCohorts] = useState<CohortData[]>([]);
  const [segments, setSegments] = useState<ReturnType<typeof userAnalyticsService.getSegmentDetails>>([]);
  const [insights, setInsights] = useState<UXInsight[]>([]);
  const [consentEnabled, setConsentEnabled] = useState(false);

  const refresh = useCallback(() => {
    setOverview(userAnalyticsService.getOverview());
    setAdoption(userAnalyticsService.getFeatureAdoption());
    setJourney(userAnalyticsService.getJourneySteps());
    setABTests(userAnalyticsService.getABTests());
    setCohorts(userAnalyticsService.getCohortData());
    setSegments(userAnalyticsService.getSegmentDetails());
    setInsights(userAnalyticsService.getInsights());
    setConsentEnabled(userAnalyticsService.hasConsent());
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  const toggleConsent = () => {
    if (consentEnabled) {
      userAnalyticsService.revokeConsent();
    } else {
      userAnalyticsService.grantConsent();
    }
    refresh();
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'journey', label: 'User Journey' },
    { id: 'adoption', label: 'Adoption' },
    { id: 'abtests', label: 'A/B Tests' },
    { id: 'cohorts', label: 'Cohorts' },
    { id: 'segments', label: 'Segments' },
    { id: 'insights', label: 'Insights' },
  ];

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>User Analytics Dashboard</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>Analytics tracking:</span>
          <button
            onClick={toggleConsent}
            style={{
              padding: '4px 12px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: consentEnabled ? '#16a34a' : '#6b7280',
              color: 'white',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {consentEnabled ? 'Enabled' : 'Disabled'}
          </button>
          <button
            onClick={refresh}
            style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', backgroundColor: 'white' }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {tabs.map(({ id, label }) => (
          <button key={id} style={tabBtn(tab === id)} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {overview && tab === 'overview' && <OverviewTab overview={overview} />}
      {tab === 'journey' && <JourneyTab steps={journey} />}
      {tab === 'adoption' && <AdoptionTab adoption={adoption} />}
      {tab === 'abtests' && <ABTestsTab tests={abTests} />}
      {tab === 'cohorts' && <CohortsTab cohorts={cohorts} />}
      {tab === 'segments' && <SegmentsTab segments={segments} />}
      {tab === 'insights' && <InsightsTab insights={insights} />}
    </div>
  );
}

export default UserAnalyticsDashboard;
