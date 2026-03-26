import React, { useState } from 'react';
import { useCompliance } from '../context/ComplianceContext';
import type {
  KycProfile, AmlCheck, ComplianceWorkflow, WorkflowStep,
  KycTier, KycProvider, AmlCheckType, WorkflowType, ReportType,
} from '../services/compliance/types';

// ─── Shared primitives ────────────────────────────────────────────────────────

const KYC_STATUS_COLOR: Record<string, string> = {
  approved: 'var(--color-success)', pending: 'var(--color-warning)', not_started: 'var(--color-text-muted)',
  rejected: 'var(--color-error)', expired: 'var(--color-error)', review: '#4fc3f7',
};
const AML_RISK_COLOR: Record<string, string> = {
  low: 'var(--color-success)', medium: 'var(--color-warning)', high: '#f97316', critical: 'var(--color-error)',
};
const WF_STATUS_COLOR: Record<string, string> = {
  pending: 'var(--color-text-muted)', in_progress: 'var(--color-warning)',
  completed: 'var(--color-success)', failed: 'var(--color-error)', cancelled: 'var(--color-text-muted)',
};
const SEV_COLOR: Record<string, string> = {
  info: 'var(--color-success)', warning: 'var(--color-warning)', critical: 'var(--color-error)',
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: color + '22', color, border: `1px solid ${color}44`, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {label.replace(/_/g, ' ')}
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

function RiskBar({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--color-error)' : score >= 40 ? 'var(--color-warning)' : 'var(--color-success)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--color-bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600, width: 28 }}>{score}</span>
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab() {
  const { kycProfiles, amlChecks, workflows, txScreenings, alerts, dismissAlert, runMonitoring } = useCompliance();
  const activeAlerts = alerts.filter(a => !a.dismissed);

  const kpis = [
    { label: 'KYC Approved', value: kycProfiles.filter(p => p.status === 'approved').length, color: 'var(--color-success)' },
    { label: 'KYC Pending', value: kycProfiles.filter(p => p.status === 'pending' || p.status === 'review').length, color: 'var(--color-warning)' },
    { label: 'AML Flags', value: amlChecks.filter(c => c.status === 'flagged').length, color: 'var(--color-error)' },
    { label: 'Open Workflows', value: workflows.filter(w => w.status === 'in_progress' || w.status === 'pending').length, color: '#4fc3f7' },
    { label: 'Tx Screened', value: txScreenings.length, color: 'var(--color-text-primary)' },
    { label: 'Active Alerts', value: activeAlerts.length, color: activeAlerts.length > 0 ? 'var(--color-error)' : 'var(--color-success)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        {kpis.map(k => (
          <div key={k.label} className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Active alerts */}
      <Card title={`Compliance Alerts (${activeAlerts.length})`} action={<Btn small onClick={runMonitoring}>↻ Refresh</Btn>}>
        {activeAlerts.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No active alerts.</p>}
        {activeAlerts.map(a => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <Badge label={a.severity} color={SEV_COLOR[a.severity]} />
              <Badge label={a.type.replace(/_/g, ' ')} color="var(--color-text-muted)" />
              <span style={{ fontSize: 13 }}>{a.message}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{timeAgo(a.createdAt)}</span>
            </div>
            <Btn small onClick={() => dismissAlert(a.id)}>Dismiss</Btn>
          </div>
        ))}
      </Card>

      {/* Overdue workflows */}
      {workflows.filter(w => w.dueDate && w.dueDate < Date.now() && w.status === 'in_progress').length > 0 && (
        <Card title="Overdue Workflows">
          {workflows.filter(w => w.dueDate && w.dueDate < Date.now() && w.status === 'in_progress').map(w => (
            <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
              <span><Badge label={w.priority} color={w.priority === 'high' ? 'var(--color-error)' : 'var(--color-warning)'} /> {w.type.replace(/_/g, ' ')} — {w.userId}</span>
              <span style={{ color: 'var(--color-error)', fontSize: 12 }}>Due {w.dueDate ? timeAgo(w.dueDate) : '—'}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── Tab: KYC ─────────────────────────────────────────────────────────────────

function KycTab() {
  const { kycProfiles, createKycProfile, updateKycStatus, verifyDocument } = useCompliance();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: '', tier: 'basic' as KycTier, provider: 'internal' as KycProvider });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState('');

  function handleCreate() {
    if (!form.userId) return;
    createKycProfile(form.userId, form.tier, form.provider);
    setShowForm(false);
    setForm({ userId: '', tier: 'basic', provider: 'internal' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn onClick={() => setShowForm(v => !v)}>+ New KYC Profile</Btn>
      </div>

      {showForm && (
        <Card title="New KYC Profile">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>User ID</label><Input value={form.userId} onChange={v => setForm(f => ({ ...f, userId: v }))} placeholder="username" /></div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>KYC Tier</label>
              <Select value={form.tier} onChange={v => setForm(f => ({ ...f, tier: v as KycTier }))} options={[{ value: 'basic', label: 'Basic' }, { value: 'standard', label: 'Standard' }, { value: 'enhanced', label: 'Enhanced' }]} />
            </div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Provider</label>
              <Select value={form.provider} onChange={v => setForm(f => ({ ...f, provider: v as KycProvider }))} options={[{ value: 'internal', label: 'Internal' }, { value: 'jumio', label: 'Jumio' }, { value: 'onfido', label: 'Onfido' }, { value: 'sumsub', label: 'Sum&Substance' }]} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="success" onClick={handleCreate}>Create</Btn>
            <Btn onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {kycProfiles.map(p => (
        <div key={p.id} className="card" style={{ padding: 14, borderLeft: `3px solid ${KYC_STATUS_COLOR[p.status]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.userId}</span>
                <Badge label={p.status} color={KYC_STATUS_COLOR[p.status]} />
                <Badge label={p.tier} color="#4fc3f7" />
                <Badge label={p.provider} color="var(--color-text-muted)" />
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                {p.nationality && `${p.nationality} · `}Created {timeAgo(p.createdAt)}
                {p.expiresAt && ` · Expires ${new Date(p.expiresAt).toLocaleDateString()}`}
              </div>
              <RiskBar score={p.riskScore} />
              {p.rejectionReason && <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 6 }}>Rejection: {p.rejectionReason}</div>}
              {p.reviewNotes && <div style={{ fontSize: 12, color: '#4fc3f7', marginTop: 4 }}>Review: {p.reviewNotes}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {p.status === 'pending' && <Btn small variant="success" onClick={() => updateKycStatus(p.id, 'approved')}>Approve</Btn>}
              {p.status === 'pending' && <Btn small variant="danger" onClick={() => { const r = prompt('Rejection reason?'); if (r) updateKycStatus(p.id, 'rejected', r); }}>Reject</Btn>}
              {(p.status === 'pending' || p.status === 'approved') && <Btn small variant="warning" onClick={() => updateKycStatus(p.id, 'review', 'Manual review triggered')}>Flag Review</Btn>}
              <Btn small onClick={() => setExpanded(expanded === p.id ? null : p.id)}>{expanded === p.id ? 'Hide' : 'Documents'} ({p.documents.length})</Btn>
            </div>
          </div>

          {expanded === p.id && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-muted)' }}>DOCUMENTS</div>
              {p.documents.length === 0 && <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No documents uploaded.</p>}
              {p.documents.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge label={d.type.replace(/_/g, ' ')} color="var(--color-text-muted)" />
                    <Badge label={d.status} color={d.status === 'verified' ? 'var(--color-success)' : d.status === 'rejected' ? 'var(--color-error)' : 'var(--color-warning)'} />
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Uploaded {timeAgo(d.uploadedAt)}</span>
                    {d.rejectionReason && <span style={{ fontSize: 11, color: 'var(--color-error)' }}>{d.rejectionReason}</span>}
                  </div>
                  {d.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn small variant="success" onClick={() => verifyDocument(p.id, d.id, true)}>Verify</Btn>
                      <Btn small variant="danger" onClick={() => { const r = prompt('Rejection reason?'); verifyDocument(p.id, d.id, false, r ?? 'Rejected'); }}>Reject</Btn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Tab: AML ─────────────────────────────────────────────────────────────────

function AmlTab() {
  const { amlChecks, kycProfiles, txScreenings, runAmlCheck, resolveAmlCheck, screenTransaction } = useCompliance();
  const [running, setRunning] = useState<string | null>(null);
  const [checkForm, setCheckForm] = useState({ userId: '', type: 'sanctions' as AmlCheckType });
  const [txForm, setTxForm] = useState({ txId: '', userId: '', amount: '', currency: 'USD', direction: 'outbound' as 'inbound' | 'outbound' });

  async function handleCheck() {
    if (!checkForm.userId) return;
    const key = `${checkForm.userId}_${checkForm.type}`;
    setRunning(key);
    await runAmlCheck(checkForm.userId, checkForm.type);
    setRunning(null);
  }

  function handleScreenTx() {
    if (!txForm.txId || !txForm.userId || !txForm.amount) return;
    screenTransaction(txForm.txId, txForm.userId, Number(txForm.amount), txForm.currency, txForm.direction);
    setTxForm({ txId: '', userId: '', amount: '', currency: 'USD', direction: 'outbound' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Run check */}
      <Card title="Run AML Check">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>User ID</label>
            <Select value={checkForm.userId} onChange={v => setCheckForm(f => ({ ...f, userId: v }))}
              options={[{ value: '', label: 'Select user…' }, ...kycProfiles.map(p => ({ value: p.userId, label: p.userId }))]} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Check Type</label>
            <Select value={checkForm.type} onChange={v => setCheckForm(f => ({ ...f, type: v as AmlCheckType }))}
              options={[{ value: 'sanctions', label: 'Sanctions' }, { value: 'pep', label: 'PEP' }, { value: 'adverse_media', label: 'Adverse Media' }, { value: 'transaction_monitoring', label: 'Tx Monitoring' }]} />
          </div>
          <Btn variant="success" onClick={handleCheck} disabled={!checkForm.userId || running !== null}>
            {running ? 'Screening…' : '▶ Run Check'}
          </Btn>
        </div>
      </Card>

      {/* Transaction screening */}
      <Card title="Screen Transaction">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
          <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Tx ID</label><Input value={txForm.txId} onChange={v => setTxForm(f => ({ ...f, txId: v }))} placeholder="tx_123" /></div>
          <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>User</label>
            <Select value={txForm.userId} onChange={v => setTxForm(f => ({ ...f, userId: v }))} options={[{ value: '', label: 'Select…' }, ...kycProfiles.map(p => ({ value: p.userId, label: p.userId }))]} />
          </div>
          <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Amount</label><Input value={txForm.amount} onChange={v => setTxForm(f => ({ ...f, amount: v }))} type="number" placeholder="1000" /></div>
          <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Currency</label>
            <Select value={txForm.currency} onChange={v => setTxForm(f => ({ ...f, currency: v }))} options={['USD','EUR','GBP','XLM'].map(c => ({ value: c, label: c }))} />
          </div>
          <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Direction</label>
            <Select value={txForm.direction} onChange={v => setTxForm(f => ({ ...f, direction: v as any }))} options={[{ value: 'outbound', label: 'Outbound' }, { value: 'inbound', label: 'Inbound' }]} />
          </div>
        </div>
        <Btn variant="success" onClick={handleScreenTx} disabled={!txForm.txId || !txForm.userId || !txForm.amount}>Screen</Btn>
      </Card>

      {/* AML checks table */}
      <Card title={`AML Checks (${amlChecks.length})`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['User', 'Type', 'Status', 'Risk', 'Details', 'Performed', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {amlChecks.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 500 }}>{c.userId}</td>
                  <td style={{ padding: '8px 10px' }}><Badge label={c.type} color="var(--color-text-muted)" /></td>
                  <td style={{ padding: '8px 10px' }}><Badge label={c.status} color={c.status === 'clear' ? 'var(--color-success)' : c.status === 'flagged' ? 'var(--color-error)' : 'var(--color-warning)'} /></td>
                  <td style={{ padding: '8px 10px' }}><Badge label={c.riskLevel} color={AML_RISK_COLOR[c.riskLevel]} /></td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.matchDetails ?? '—'}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--color-text-muted)', fontSize: 12 }}>{timeAgo(c.performedAt)}</td>
                  <td style={{ padding: '8px 10px' }}>
                    {c.status === 'flagged' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn small variant="success" onClick={() => resolveAmlCheck(c.id, 'clear', 'compliance_officer', 'Reviewed and cleared')}>Clear</Btn>
                        <Btn small variant="warning" onClick={() => resolveAmlCheck(c.id, 'whitelisted', 'compliance_officer', 'Whitelisted')}>Whitelist</Btn>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Transaction screenings */}
      {txScreenings.length > 0 && (
        <Card title={`Transaction Screenings (${txScreenings.length})`}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Tx ID', 'User', 'Amount', 'Direction', 'Risk Score', 'Flags', 'Status', 'Time'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txScreenings.slice(0, 50).map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 11 }}>{s.transactionId}</td>
                    <td style={{ padding: '6px 10px' }}>{s.userId}</td>
                    <td style={{ padding: '6px 10px' }}>{s.amount.toLocaleString()} {s.currency}</td>
                    <td style={{ padding: '6px 10px' }}><Badge label={s.direction} color={s.direction === 'outbound' ? '#f97316' : 'var(--color-success)'} /></td>
                    <td style={{ padding: '6px 10px' }}><RiskBar score={s.riskScore} /></td>
                    <td style={{ padding: '6px 10px', fontSize: 11, color: 'var(--color-text-muted)' }}>{s.flags.join(', ') || '—'}</td>
                    <td style={{ padding: '6px 10px' }}><Badge label={s.status} color={s.status === 'clear' ? 'var(--color-success)' : 'var(--color-error)'} /></td>
                    <td style={{ padding: '6px 10px', color: 'var(--color-text-muted)' }}>{timeAgo(s.screenedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Workflows ───────────────────────────────────────────────────────────

function WorkflowsTab() {
  const { workflows, kycProfiles, createWorkflow, advanceWorkflowStep, updateWorkflow } = useCompliance();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'kyc_onboarding' as WorkflowType, userId: '', priority: 'medium' as ComplianceWorkflow['priority'] });
  const [expanded, setExpanded] = useState<string | null>(null);

  function handleCreate() {
    if (!form.userId) return;
    createWorkflow(form.type, form.userId, form.priority);
    setShowForm(false);
  }

  const WORKFLOW_TYPES: WorkflowType[] = ['kyc_onboarding', 'aml_review', 'enhanced_due_diligence', 'periodic_review', 'offboarding'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn onClick={() => setShowForm(v => !v)}>+ New Workflow</Btn>
      </div>

      {showForm && (
        <Card title="New Workflow">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Type</label>
              <Select value={form.type} onChange={v => setForm(f => ({ ...f, type: v as WorkflowType }))} options={WORKFLOW_TYPES.map(t => ({ value: t, label: t.replace(/_/g, ' ') }))} />
            </div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>User</label>
              <Select value={form.userId} onChange={v => setForm(f => ({ ...f, userId: v }))} options={[{ value: '', label: 'Select…' }, ...kycProfiles.map(p => ({ value: p.userId, label: p.userId }))]} />
            </div>
            <div><label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Priority</label>
              <Select value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v as any }))} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="success" onClick={handleCreate} disabled={!form.userId}>Create</Btn>
            <Btn onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {workflows.map(w => {
        const isOverdue = w.dueDate && w.dueDate < Date.now() && w.status === 'in_progress';
        const completedSteps = w.steps.filter(s => s.status === 'completed').length;
        const progress = Math.round((completedSteps / w.steps.length) * 100);
        return (
          <div key={w.id} className="card" style={{ padding: 14, borderLeft: `3px solid ${isOverdue ? 'var(--color-error)' : WF_STATUS_COLOR[w.status]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{w.type.replace(/_/g, ' ')}</span>
                  <Badge label={w.userId} color="var(--color-text-muted)" />
                  <Badge label={w.status.replace(/_/g, ' ')} color={WF_STATUS_COLOR[w.status]} />
                  <Badge label={w.priority} color={w.priority === 'high' ? 'var(--color-error)' : w.priority === 'medium' ? 'var(--color-warning)' : 'var(--color-text-muted)'} />
                  {isOverdue && <Badge label="overdue" color="var(--color-error)" />}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                  {completedSteps}/{w.steps.length} steps · {progress}% complete
                  {w.dueDate && ` · Due ${new Date(w.dueDate).toLocaleDateString()}`}
                  {w.assignedTo && ` · Assigned to ${w.assignedTo}`}
                </div>
                {/* Progress bar */}
                <div style={{ height: 6, background: 'var(--color-bg-tertiary)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: w.status === 'completed' ? 'var(--color-success)' : 'var(--color-highlight)', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {w.status === 'in_progress' && <Btn small variant="danger" onClick={() => updateWorkflow(w.id, { status: 'cancelled' })}>Cancel</Btn>}
                <Btn small onClick={() => setExpanded(expanded === w.id ? null : w.id)}>{expanded === w.id ? 'Hide' : 'Steps'}</Btn>
              </div>
            </div>

            {expanded === w.id && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                {w.steps.map((step, idx) => (
                  <div key={step.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 20 }}>{idx + 1}.</span>
                      <span style={{ fontSize: 13 }}>{step.name}</span>
                      <Badge label={step.status.replace(/_/g, ' ')} color={WF_STATUS_COLOR[step.status]} />
                      {step.completedAt && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{timeAgo(step.completedAt)}</span>}
                    </div>
                    {step.status === 'in_progress' && (
                      <Btn small variant="success" onClick={() => advanceWorkflowStep(w.id, step.id)}>Complete</Btn>
                    )}
                    {step.status === 'pending' && idx === w.steps.findIndex(s => s.status === 'pending') && (
                      <Btn small onClick={() => advanceWorkflowStep(w.id, step.id)}>Start</Btn>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Reports ─────────────────────────────────────────────────────────────

function ReportsTab() {
  const { reports, generateReport, finalizeReport, downloadReport } = useCompliance();
  const [form, setForm] = useState({ type: 'kyc_summary' as ReportType, from: '', to: '' });

  function handleGenerate() {
    const from = form.from ? new Date(form.from).getTime() : Date.now() - 30 * 86400000;
    const to = form.to ? new Date(form.to).getTime() : Date.now();
    generateReport(form.type, from, to);
  }

  const REPORT_TYPES: { value: ReportType; label: string }[] = [
    { value: 'kyc_summary', label: 'KYC Summary' },
    { value: 'aml_summary', label: 'AML Summary' },
    { value: 'risk_assessment', label: 'Risk Assessment' },
    { value: 'sar', label: 'Suspicious Activity Report (SAR)' },
    { value: 'ctr', label: 'Currency Transaction Report (CTR)' },
  ];

  const STATUS_COLOR: Record<string, string> = { draft: 'var(--color-warning)', final: 'var(--color-success)', submitted: '#4fc3f7' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card title="Generate Report">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Report Type</label>
            <Select value={form.type} onChange={v => setForm(f => ({ ...f, type: v as ReportType }))} options={REPORT_TYPES} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>From</label>
            <Input value={form.from} onChange={v => setForm(f => ({ ...f, from: v }))} type="date" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>To</label>
            <Input value={form.to} onChange={v => setForm(f => ({ ...f, to: v }))} type="date" />
          </div>
          <Btn variant="success" onClick={handleGenerate}>Generate</Btn>
        </div>
      </Card>

      {reports.map(r => (
        <div key={r.id} className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</span>
                <Badge label={r.status} color={STATUS_COLOR[r.status]} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Generated {timeAgo(r.generatedAt)} · Period: {new Date(r.period.from).toLocaleDateString()} – {new Date(r.period.to).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {r.status === 'draft' && <Btn small variant="success" onClick={() => finalizeReport(r.id)}>Finalize</Btn>}
              <Btn small onClick={() => downloadReport(r.id)}>↓ CSV</Btn>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {Object.entries(r.summary).map(([k, v]) => (
              <div key={k} style={{ padding: '8px 12px', background: 'var(--color-bg-tertiary)', borderRadius: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>{k.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {reports.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No reports generated yet.</p>}
    </div>
  );
}

// ─── Root ComplianceDashboard ─────────────────────────────────────────────────

type CompTab = 'overview' | 'kyc' | 'aml' | 'workflows' | 'reports';

export function ComplianceDashboard(): JSX.Element {
  const { alerts, workflows, amlChecks } = useCompliance();
  const [tab, setTab] = useState<CompTab>('overview');

  const activeAlerts = alerts.filter(a => !a.dismissed).length;
  const openWorkflows = workflows.filter(w => w.status === 'in_progress' || w.status === 'pending').length;
  const amlFlags = amlChecks.filter(c => c.status === 'flagged').length;

  const tabs: { id: CompTab; label: string }[] = [
    { id: 'overview', label: `📋 Overview${activeAlerts ? ` (${activeAlerts})` : ''}` },
    { id: 'kyc', label: '🪪 KYC' },
    { id: 'aml', label: `🔍 AML${amlFlags ? ` (${amlFlags})` : ''}` },
    { id: 'workflows', label: `⚙️ Workflows${openWorkflows ? ` (${openWorkflows})` : ''}` },
    { id: 'reports', label: '📊 Reports' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Compliance</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeAlerts > 0 && <span style={{ fontSize: 12, padding: '4px 10px', background: 'var(--color-error)22', color: 'var(--color-error)', border: '1px solid var(--color-error)44', borderRadius: 10 }}>🚨 {activeAlerts} alert{activeAlerts > 1 ? 's' : ''}</span>}
          {amlFlags > 0 && <span style={{ fontSize: 12, padding: '4px 10px', background: 'var(--color-warning)22', color: 'var(--color-warning)', border: '1px solid var(--color-warning)44', borderRadius: 10 }}>⚠ {amlFlags} AML flag{amlFlags > 1 ? 's' : ''}</span>}
        </div>
      </div>

      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t.id ? 'var(--color-highlight)' : 'var(--color-text-muted)',
            borderBottom: tab === t.id ? '2px solid var(--color-highlight)' : '2px solid transparent',
            fontWeight: tab === t.id ? 600 : 400,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'kyc' && <KycTab />}
        {tab === 'aml' && <AmlTab />}
        {tab === 'workflows' && <WorkflowsTab />}
        {tab === 'reports' && <ReportsTab />}
      </div>
    </div>
  );
}
