import {
  ComplianceState, KycProfile, KycTier, KycProvider, KycDocument,
  AmlCheck, AmlCheckType, AmlRiskLevel, TransactionScreening,
  ComplianceWorkflow, WorkflowType, WorkflowStep,
  ComplianceReport, ReportType, ComplianceAlert, AlertType,
} from './types';

const STORAGE_KEY = 'compliance_state';

// ─── Sanctions / PEP lists (demo) ─────────────────────────────────────────────

const SANCTIONS_LIST = ['OFAC_001', 'OFAC_002', 'EU_SANCTION_003'];
const HIGH_RISK_COUNTRIES = ['KP', 'IR', 'SY', 'CU'];
const PEP_KEYWORDS = ['minister', 'senator', 'president', 'governor', 'ambassador'];

// ─── Seed data ────────────────────────────────────────────────────────────────

function seedProfiles(): KycProfile[] {
  const now = Date.now();
  return [
    {
      id: 'kyc_1', userId: 'alice', tier: 'standard', status: 'approved', provider: 'internal',
      createdAt: now - 86400000 * 30, updatedAt: now - 86400000 * 2, approvedAt: now - 86400000 * 28,
      expiresAt: now + 86400000 * 335, riskScore: 12, nationality: 'US', countryOfResidence: 'US',
      documents: [
        { id: 'd1', type: 'passport', status: 'verified', uploadedAt: now - 86400000 * 30, verifiedAt: now - 86400000 * 28, expiresAt: now + 86400000 * 1825 },
        { id: 'd2', type: 'utility_bill', status: 'verified', uploadedAt: now - 86400000 * 30, verifiedAt: now - 86400000 * 28 },
      ],
    },
    {
      id: 'kyc_2', userId: 'bob', tier: 'basic', status: 'pending', provider: 'internal',
      createdAt: now - 86400000 * 3, updatedAt: now - 86400000 * 1, riskScore: 35,
      nationality: 'GB', countryOfResidence: 'GB',
      documents: [{ id: 'd3', type: 'national_id', status: 'pending', uploadedAt: now - 86400000 * 3 }],
    },
    {
      id: 'kyc_3', userId: 'carol', tier: 'enhanced', status: 'review', provider: 'onfido',
      createdAt: now - 86400000 * 7, updatedAt: now - 86400000 * 1, riskScore: 68,
      nationality: 'DE', countryOfResidence: 'DE', reviewNotes: 'PEP match — manual review required',
      documents: [
        { id: 'd4', type: 'passport', status: 'verified', uploadedAt: now - 86400000 * 7, verifiedAt: now - 86400000 * 5 },
        { id: 'd5', type: 'bank_statement', status: 'pending', uploadedAt: now - 86400000 * 2 },
      ],
    },
    {
      id: 'kyc_4', userId: 'dave', tier: 'basic', status: 'rejected', provider: 'internal',
      createdAt: now - 86400000 * 14, updatedAt: now - 86400000 * 10, riskScore: 85,
      rejectionReason: 'Document forgery detected', nationality: 'XX', countryOfResidence: 'XX',
      documents: [{ id: 'd6', type: 'national_id', status: 'rejected', uploadedAt: now - 86400000 * 14, rejectionReason: 'Suspected forgery' }],
    },
  ];
}

function seedAmlChecks(): AmlCheck[] {
  const now = Date.now();
  return [
    { id: 'aml_1', userId: 'alice', type: 'sanctions', status: 'clear', riskLevel: 'low', performedAt: now - 86400000 * 28 },
    { id: 'aml_2', userId: 'alice', type: 'pep', status: 'clear', riskLevel: 'low', performedAt: now - 86400000 * 28 },
    { id: 'aml_3', userId: 'carol', type: 'pep', status: 'flagged', riskLevel: 'high', performedAt: now - 86400000 * 5, matchDetails: 'Possible PEP match — political exposure in DE' },
    { id: 'aml_4', userId: 'carol', type: 'adverse_media', status: 'flagged', riskLevel: 'medium', performedAt: now - 86400000 * 5, matchDetails: 'Adverse media articles found' },
    { id: 'aml_5', userId: 'dave', type: 'sanctions', status: 'flagged', riskLevel: 'critical', performedAt: now - 86400000 * 10, matchDetails: 'OFAC SDN list match' },
  ];
}

function seedWorkflows(): ComplianceWorkflow[] {
  const now = Date.now();
  const kycSteps = (done: number): WorkflowStep[] => [
    { id: 's1', name: 'Document Collection', status: done >= 1 ? 'completed' : 'pending', completedAt: done >= 1 ? now - 86400000 * 5 : undefined },
    { id: 's2', name: 'Identity Verification', status: done >= 2 ? 'completed' : done === 1 ? 'in_progress' : 'pending', completedAt: done >= 2 ? now - 86400000 * 3 : undefined },
    { id: 's3', name: 'AML Screening', status: done >= 3 ? 'completed' : done === 2 ? 'in_progress' : 'pending' },
    { id: 's4', name: 'Risk Assessment', status: done >= 4 ? 'completed' : 'pending' },
    { id: 's5', name: 'Approval', status: done >= 5 ? 'completed' : 'pending' },
  ];
  return [
    { id: 'wf_1', type: 'kyc_onboarding', userId: 'alice', status: 'completed', createdAt: now - 86400000 * 30, updatedAt: now - 86400000 * 28, completedAt: now - 86400000 * 28, steps: kycSteps(5), priority: 'medium' },
    { id: 'wf_2', type: 'kyc_onboarding', userId: 'bob', status: 'in_progress', createdAt: now - 86400000 * 3, updatedAt: now - 86400000 * 1, steps: kycSteps(1), priority: 'medium', dueDate: now + 86400000 * 4 },
    { id: 'wf_3', type: 'enhanced_due_diligence', userId: 'carol', status: 'in_progress', createdAt: now - 86400000 * 5, updatedAt: now - 86400000 * 1, steps: kycSteps(2), priority: 'high', dueDate: now + 86400000 * 2, assignedTo: 'compliance_officer' },
    { id: 'wf_4', type: 'aml_review', userId: 'dave', status: 'in_progress', createdAt: now - 86400000 * 10, updatedAt: now - 86400000 * 1, steps: kycSteps(1), priority: 'high', dueDate: now - 86400000 * 2 },
  ];
}

// ─── Service ──────────────────────────────────────────────────────────────────

class ComplianceService {
  private state: ComplianceState;
  private listeners: Set<(s: ComplianceState) => void> = new Set();

  constructor() {
    const stored = this.load();
    this.state = stored ?? this.defaultState();
    this.scheduleMonitoring();
  }

  private defaultState(): ComplianceState {
    return {
      kycProfiles: seedProfiles(),
      amlChecks: seedAmlChecks(),
      txScreenings: [],
      workflows: seedWorkflows(),
      reports: [],
      alerts: [],
    };
  }

  private load(): ComplianceState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch { /* quota */ }
  }

  private emit() {
    const s = this.getState();
    this.listeners.forEach(fn => fn(s));
    this.save();
  }

  subscribe(fn: (s: ComplianceState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState(): ComplianceState { return { ...this.state }; }

  // ── Alerts ─────────────────────────────────────────────────────────────────

  private addAlert(type: AlertType, severity: ComplianceAlert['severity'], message: string, userId?: string, relatedId?: string) {
    const alert: ComplianceAlert = {
      id: `ca_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      type, severity, message, userId, relatedId,
      createdAt: Date.now(), dismissed: false,
    };
    this.state = { ...this.state, alerts: [alert, ...this.state.alerts].slice(0, 200) };
  }

  dismissAlert(id: string) {
    this.state = { ...this.state, alerts: this.state.alerts.map(a => a.id === id ? { ...a, dismissed: true } : a) };
    this.emit();
  }

  // ── Monitoring ─────────────────────────────────────────────────────────────

  private scheduleMonitoring() {
    // Run once on init to seed alerts from existing data
    setTimeout(() => this.runMonitoring(), 500);
  }

  runMonitoring() {
    const now = Date.now();
    const newAlerts: ComplianceAlert[] = [];

    // KYC expiry warnings
    this.state.kycProfiles.forEach(p => {
      if (p.expiresAt && p.expiresAt - now < 30 * 86400000 && p.status === 'approved') {
        newAlerts.push({ id: `ca_exp_${p.id}`, type: 'kyc_expiry', severity: p.expiresAt - now < 7 * 86400000 ? 'critical' : 'warning', message: `KYC for ${p.userId} expires ${new Date(p.expiresAt).toLocaleDateString()}`, userId: p.userId, relatedId: p.id, createdAt: now, dismissed: false });
      }
    });

    // Overdue workflows
    this.state.workflows.forEach(w => {
      if (w.dueDate && w.dueDate < now && w.status === 'in_progress') {
        newAlerts.push({ id: `ca_wf_${w.id}`, type: 'workflow_overdue', severity: 'warning', message: `Workflow "${w.type.replace(/_/g, ' ')}" for ${w.userId} is overdue`, userId: w.userId, relatedId: w.id, createdAt: now, dismissed: false });
      }
    });

    // AML flags
    this.state.amlChecks.filter(c => c.status === 'flagged' && c.riskLevel === 'critical').forEach(c => {
      newAlerts.push({ id: `ca_aml_${c.id}`, type: 'aml_flag', severity: 'critical', message: `Critical AML flag for ${c.userId}: ${c.matchDetails ?? c.type}`, userId: c.userId, relatedId: c.id, createdAt: now, dismissed: false });
    });

    // Deduplicate by id
    const existingIds = new Set(this.state.alerts.map(a => a.id));
    const fresh = newAlerts.filter(a => !existingIds.has(a.id));
    if (fresh.length) {
      this.state = { ...this.state, alerts: [...fresh, ...this.state.alerts].slice(0, 200) };
      this.emit();
    }
  }

  // ── KYC ────────────────────────────────────────────────────────────────────

  createKycProfile(userId: string, tier: KycTier, provider: KycProvider): KycProfile {
    const profile: KycProfile = {
      id: `kyc_${Date.now()}`, userId, tier, provider,
      status: 'not_started', createdAt: Date.now(), updatedAt: Date.now(),
      riskScore: 0, documents: [],
    };
    this.state = { ...this.state, kycProfiles: [...this.state.kycProfiles, profile] };
    this.createWorkflow('kyc_onboarding', userId, 'medium');
    this.emit();
    return profile;
  }

  updateKycStatus(id: string, status: KycProfile['status'], notes?: string) {
    this.state = {
      ...this.state,
      kycProfiles: this.state.kycProfiles.map(p => p.id === id ? {
        ...p, status, updatedAt: Date.now(),
        approvedAt: status === 'approved' ? Date.now() : p.approvedAt,
        expiresAt: status === 'approved' ? Date.now() + 365 * 86400000 : p.expiresAt,
        rejectionReason: status === 'rejected' ? notes : p.rejectionReason,
        reviewNotes: notes ?? p.reviewNotes,
      } : p),
    };
    this.emit();
  }

  addDocument(profileId: string, doc: Omit<KycDocument, 'id' | 'uploadedAt' | 'status'>): KycDocument {
    const document: KycDocument = { ...doc, id: `doc_${Date.now()}`, uploadedAt: Date.now(), status: 'pending' };
    this.state = {
      ...this.state,
      kycProfiles: this.state.kycProfiles.map(p =>
        p.id === profileId ? { ...p, documents: [...p.documents, document], updatedAt: Date.now() } : p
      ),
    };
    this.emit();
    return document;
  }

  verifyDocument(profileId: string, docId: string, approved: boolean, reason?: string) {
    this.state = {
      ...this.state,
      kycProfiles: this.state.kycProfiles.map(p =>
        p.id === profileId ? {
          ...p,
          documents: p.documents.map(d => d.id === docId ? {
            ...d,
            status: approved ? 'verified' : 'rejected',
            verifiedAt: approved ? Date.now() : undefined,
            rejectionReason: !approved ? reason : undefined,
          } : d),
          updatedAt: Date.now(),
        } : p
      ),
    };
    this.emit();
  }

  // ── AML ────────────────────────────────────────────────────────────────────

  async runAmlCheck(userId: string, type: AmlCheckType): Promise<AmlCheck> {
    // Simulate provider call
    await new Promise(r => setTimeout(r, 400 + Math.random() * 600));

    const profile = this.state.kycProfiles.find(p => p.userId === userId);
    let riskLevel: AmlRiskLevel = 'low';
    let status: AmlCheck['status'] = 'clear';
    let matchDetails: string | undefined;

    // Simulate screening logic
    if (type === 'sanctions' && profile?.nationality && HIGH_RISK_COUNTRIES.includes(profile.nationality)) {
      riskLevel = 'critical'; status = 'flagged'; matchDetails = `High-risk jurisdiction: ${profile.nationality}`;
    } else if (type === 'pep' && profile?.reviewNotes?.toLowerCase().includes('pep')) {
      riskLevel = 'high'; status = 'flagged'; matchDetails = 'Potential PEP match detected';
    } else if (Math.random() < 0.1) {
      riskLevel = 'medium'; status = 'flagged'; matchDetails = 'Adverse media match — review required';
    }

    const check: AmlCheck = {
      id: `aml_${Date.now()}`, userId, type, status, riskLevel,
      performedAt: Date.now(), expiresAt: Date.now() + 90 * 86400000, matchDetails,
    };
    this.state = { ...this.state, amlChecks: [check, ...this.state.amlChecks] };
    if (status === 'flagged') this.addAlert('aml_flag', riskLevel === 'critical' ? 'critical' : 'warning', `AML ${type} flag for ${userId}: ${matchDetails}`, userId, check.id);
    this.emit();
    return check;
  }

  resolveAmlCheck(id: string, resolution: 'clear' | 'whitelisted', resolvedBy: string, notes?: string) {
    this.state = {
      ...this.state,
      amlChecks: this.state.amlChecks.map(c => c.id === id ? { ...c, status: resolution, resolvedAt: Date.now(), resolvedBy, notes } : c),
    };
    this.emit();
  }

  screenTransaction(txId: string, userId: string, amount: number, currency: string, direction: 'inbound' | 'outbound'): TransactionScreening {
    // Risk scoring heuristics
    const flags: string[] = [];
    let riskScore = 0;
    if (amount > 10000) { flags.push('large_transaction'); riskScore += 30; }
    if (amount > 50000) { flags.push('very_large_transaction'); riskScore += 40; }
    if (direction === 'outbound' && amount > 5000) { flags.push('large_outbound'); riskScore += 10; }
    const profile = this.state.kycProfiles.find(p => p.userId === userId);
    if (profile?.riskScore && profile.riskScore > 60) { flags.push('high_risk_user'); riskScore += 20; }
    riskScore = Math.min(100, riskScore);

    const screening: TransactionScreening = {
      id: `scr_${Date.now()}`, transactionId: txId, userId, amount, currency, direction,
      riskScore, flags, status: riskScore >= 70 ? 'flagged' : 'clear', screenedAt: Date.now(),
    };
    this.state = { ...this.state, txScreenings: [screening, ...this.state.txScreenings].slice(0, 500) };
    if (screening.status === 'flagged') this.addAlert('high_risk_tx', riskScore >= 90 ? 'critical' : 'warning', `High-risk transaction ${txId} for ${userId} — score ${riskScore}`, userId, txId);
    this.emit();
    return screening;
  }

  // ── Workflows ──────────────────────────────────────────────────────────────

  createWorkflow(type: WorkflowType, userId: string, priority: ComplianceWorkflow['priority']): ComplianceWorkflow {
    const stepNames: Record<WorkflowType, string[]> = {
      kyc_onboarding: ['Document Collection', 'Identity Verification', 'AML Screening', 'Risk Assessment', 'Approval'],
      aml_review: ['Flag Review', 'Evidence Gathering', 'Risk Decision', 'Escalation / Closure'],
      enhanced_due_diligence: ['Source of Funds', 'PEP Verification', 'Adverse Media Review', 'Senior Approval'],
      periodic_review: ['Data Refresh', 'Re-screening', 'Risk Re-assessment', 'Sign-off'],
      offboarding: ['Account Freeze', 'Final AML Check', 'Record Archival', 'Closure'],
    };
    const steps: WorkflowStep[] = (stepNames[type] ?? ['Step 1']).map((name, i) => ({
      id: `step_${i}`, name, status: 'pending',
    }));
    const wf: ComplianceWorkflow = {
      id: `wf_${Date.now()}`, type, userId, status: 'pending',
      createdAt: Date.now(), updatedAt: Date.now(),
      steps, priority, dueDate: Date.now() + 7 * 86400000,
    };
    this.state = { ...this.state, workflows: [wf, ...this.state.workflows] };
    this.emit();
    return wf;
  }

  advanceWorkflowStep(workflowId: string, stepId: string, notes?: string) {
    this.state = {
      ...this.state,
      workflows: this.state.workflows.map(w => {
        if (w.id !== workflowId) return w;
        const steps = w.steps.map(s => s.id === stepId ? { ...s, status: 'completed' as const, completedAt: Date.now(), notes } : s);
        const allDone = steps.every(s => s.status === 'completed');
        const anyInProgress = steps.some(s => s.status === 'in_progress');
        // Auto-start next pending step
        let started = false;
        const advanced = steps.map(s => {
          if (s.status === 'pending' && !started) { started = true; return { ...s, status: 'in_progress' as const }; }
          return s;
        });
        return { ...w, steps: advanced, status: allDone ? 'completed' : 'in_progress', updatedAt: Date.now(), completedAt: allDone ? Date.now() : undefined };
      }),
    };
    this.emit();
  }

  updateWorkflow(id: string, patch: Partial<ComplianceWorkflow>) {
    this.state = { ...this.state, workflows: this.state.workflows.map(w => w.id === id ? { ...w, ...patch, updatedAt: Date.now() } : w) };
    this.emit();
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  generateReport(type: ReportType, from: number, to: number): ComplianceReport {
    const profiles = this.state.kycProfiles;
    const checks = this.state.amlChecks.filter(c => c.performedAt >= from && c.performedAt <= to);
    const screenings = this.state.txScreenings.filter(s => s.screenedAt >= from && s.screenedAt <= to);

    const summaries: Record<ReportType, Record<string, number | string>> = {
      kyc_summary: {
        total_profiles: profiles.length,
        approved: profiles.filter(p => p.status === 'approved').length,
        pending: profiles.filter(p => p.status === 'pending').length,
        rejected: profiles.filter(p => p.status === 'rejected').length,
        review: profiles.filter(p => p.status === 'review').length,
        avg_risk_score: profiles.length ? Math.round(profiles.reduce((s, p) => s + p.riskScore, 0) / profiles.length) : 0,
      },
      aml_summary: {
        total_checks: checks.length,
        flagged: checks.filter(c => c.status === 'flagged').length,
        clear: checks.filter(c => c.status === 'clear').length,
        critical_flags: checks.filter(c => c.riskLevel === 'critical').length,
        sanctions_hits: checks.filter(c => c.type === 'sanctions' && c.status === 'flagged').length,
        pep_matches: checks.filter(c => c.type === 'pep' && c.status === 'flagged').length,
      },
      risk_assessment: {
        high_risk_users: profiles.filter(p => p.riskScore >= 70).length,
        medium_risk_users: profiles.filter(p => p.riskScore >= 40 && p.riskScore < 70).length,
        low_risk_users: profiles.filter(p => p.riskScore < 40).length,
        flagged_transactions: screenings.filter(s => s.status === 'flagged').length,
        total_screened: screenings.length,
      },
      sar: { suspicious_activity_reports: screenings.filter(s => s.riskScore >= 80).length, period: `${new Date(from).toLocaleDateString()} – ${new Date(to).toLocaleDateString()}` },
      ctr: { currency_transaction_reports: screenings.filter(s => s.amount >= 10000).length, total_amount: screenings.filter(s => s.amount >= 10000).reduce((s, t) => s + t.amount, 0) },
    };

    const report: ComplianceReport = {
      id: `rpt_${Date.now()}`, type,
      title: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      generatedAt: Date.now(), period: { from, to },
      status: 'draft', summary: summaries[type] ?? {},
    };
    this.state = { ...this.state, reports: [report, ...this.state.reports] };
    this.emit();
    return report;
  }

  finalizeReport(id: string) {
    this.state = { ...this.state, reports: this.state.reports.map(r => r.id === id ? { ...r, status: 'final' } : r) };
    this.emit();
  }

  downloadReport(id: string) {
    const report = this.state.reports.find(r => r.id === id);
    if (!report) return;
    const rows = [['Field', 'Value'], ...Object.entries(report.summary).map(([k, v]) => [k, String(v)])];
    const csv = `# ${report.title}\n# Generated: ${new Date(report.generatedAt).toISOString()}\n# Period: ${new Date(report.period.from).toLocaleDateString()} - ${new Date(report.period.to).toLocaleDateString()}\n\n` + rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${report.type}-${Date.now()}.csv`;
    a.click();
  }
}

export const complianceService = new ComplianceService();
