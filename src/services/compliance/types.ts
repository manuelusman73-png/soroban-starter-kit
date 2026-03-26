// ─── KYC ─────────────────────────────────────────────────────────────────────

export type KycStatus = 'not_started' | 'pending' | 'approved' | 'rejected' | 'expired' | 'review';
export type KycTier = 'basic' | 'standard' | 'enhanced';
export type KycProvider = 'internal' | 'jumio' | 'onfido' | 'sumsub';

export interface KycDocument {
  id: string;
  type: 'passport' | 'national_id' | 'drivers_license' | 'utility_bill' | 'bank_statement';
  status: 'pending' | 'verified' | 'rejected';
  uploadedAt: number;
  verifiedAt?: number;
  expiresAt?: number;
  rejectionReason?: string;
}

export interface KycProfile {
  id: string;
  userId: string;
  tier: KycTier;
  status: KycStatus;
  provider: KycProvider;
  createdAt: number;
  updatedAt: number;
  approvedAt?: number;
  expiresAt?: number;
  documents: KycDocument[];
  riskScore: number;          // 0–100
  nationality?: string;
  countryOfResidence?: string;
  rejectionReason?: string;
  reviewNotes?: string;
}

// ─── AML ─────────────────────────────────────────────────────────────────────

export type AmlRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AmlCheckType = 'sanctions' | 'pep' | 'adverse_media' | 'transaction_monitoring';
export type AmlCheckStatus = 'clear' | 'flagged' | 'pending' | 'whitelisted';

export interface AmlCheck {
  id: string;
  userId: string;
  type: AmlCheckType;
  status: AmlCheckStatus;
  riskLevel: AmlRiskLevel;
  performedAt: number;
  expiresAt?: number;
  matchDetails?: string;
  resolvedAt?: number;
  resolvedBy?: string;
  notes?: string;
}

export interface TransactionScreening {
  id: string;
  transactionId: string;
  userId: string;
  amount: number;
  currency: string;
  direction: 'inbound' | 'outbound';
  riskScore: number;
  flags: string[];
  status: AmlCheckStatus;
  screenedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
}

// ─── Workflows ────────────────────────────────────────────────────────────────

export type WorkflowStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type WorkflowType = 'kyc_onboarding' | 'aml_review' | 'enhanced_due_diligence' | 'periodic_review' | 'offboarding';

export interface WorkflowStep {
  id: string;
  name: string;
  status: WorkflowStatus;
  completedAt?: number;
  assignedTo?: string;
  notes?: string;
}

export interface ComplianceWorkflow {
  id: string;
  type: WorkflowType;
  userId: string;
  status: WorkflowStatus;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  steps: WorkflowStep[];
  priority: 'low' | 'medium' | 'high';
  dueDate?: number;
  assignedTo?: string;
}

// ─── Reporting ────────────────────────────────────────────────────────────────

export type ReportType = 'sar' | 'ctr' | 'kyc_summary' | 'aml_summary' | 'risk_assessment';

export interface ComplianceReport {
  id: string;
  type: ReportType;
  title: string;
  generatedAt: number;
  period: { from: number; to: number };
  status: 'draft' | 'final' | 'submitted';
  summary: Record<string, number | string>;
  filedWith?: string;
  filedAt?: number;
}

// ─── Monitoring ───────────────────────────────────────────────────────────────

export type AlertType = 'kyc_expiry' | 'aml_flag' | 'high_risk_tx' | 'workflow_overdue' | 'sanctions_hit';

export interface ComplianceAlert {
  id: string;
  type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  userId?: string;
  relatedId?: string;
  createdAt: number;
  dismissed: boolean;
  resolvedAt?: number;
}

// ─── State ────────────────────────────────────────────────────────────────────

export interface ComplianceState {
  kycProfiles: KycProfile[];
  amlChecks: AmlCheck[];
  txScreenings: TransactionScreening[];
  workflows: ComplianceWorkflow[];
  reports: ComplianceReport[];
  alerts: ComplianceAlert[];
}
