import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { complianceService } from '../services/compliance/complianceService';
import type {
  ComplianceState, KycTier, KycProvider, KycDocument,
  AmlCheckType, WorkflowType, ReportType, ComplianceWorkflow,
} from '../services/compliance/types';

interface ComplianceContextType extends ComplianceState {
  createKycProfile: (userId: string, tier: KycTier, provider: KycProvider) => void;
  updateKycStatus: (id: string, status: import('../services/compliance/types').KycStatus, notes?: string) => void;
  addDocument: (profileId: string, doc: Omit<KycDocument, 'id' | 'uploadedAt' | 'status'>) => void;
  verifyDocument: (profileId: string, docId: string, approved: boolean, reason?: string) => void;
  runAmlCheck: (userId: string, type: AmlCheckType) => Promise<void>;
  resolveAmlCheck: (id: string, resolution: 'clear' | 'whitelisted', resolvedBy: string, notes?: string) => void;
  screenTransaction: (txId: string, userId: string, amount: number, currency: string, direction: 'inbound' | 'outbound') => void;
  createWorkflow: (type: WorkflowType, userId: string, priority: ComplianceWorkflow['priority']) => void;
  advanceWorkflowStep: (workflowId: string, stepId: string, notes?: string) => void;
  updateWorkflow: (id: string, patch: Partial<ComplianceWorkflow>) => void;
  generateReport: (type: ReportType, from: number, to: number) => void;
  finalizeReport: (id: string) => void;
  downloadReport: (id: string) => void;
  dismissAlert: (id: string) => void;
  runMonitoring: () => void;
}

const ComplianceContext = createContext<ComplianceContextType | undefined>(undefined);

export function ComplianceProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<ComplianceState>(complianceService.getState());

  useEffect(() => complianceService.subscribe(setState), []);

  const value: ComplianceContextType = {
    ...state,
    createKycProfile: (u, t, p) => complianceService.createKycProfile(u, t, p),
    updateKycStatus: (id, s, n) => complianceService.updateKycStatus(id, s, n),
    addDocument: (pid, doc) => complianceService.addDocument(pid, doc),
    verifyDocument: (pid, did, ok, r) => complianceService.verifyDocument(pid, did, ok, r),
    runAmlCheck: async (u, t) => { await complianceService.runAmlCheck(u, t); },
    resolveAmlCheck: (id, r, by, n) => complianceService.resolveAmlCheck(id, r, by, n),
    screenTransaction: (tx, u, a, c, d) => complianceService.screenTransaction(tx, u, a, c, d),
    createWorkflow: (t, u, p) => complianceService.createWorkflow(t, u, p),
    advanceWorkflowStep: (wid, sid, n) => complianceService.advanceWorkflowStep(wid, sid, n),
    updateWorkflow: (id, p) => complianceService.updateWorkflow(id, p),
    generateReport: (t, f, to) => complianceService.generateReport(t, f, to),
    finalizeReport: (id) => complianceService.finalizeReport(id),
    downloadReport: (id) => complianceService.downloadReport(id),
    dismissAlert: (id) => complianceService.dismissAlert(id),
    runMonitoring: () => complianceService.runMonitoring(),
  };

  return <ComplianceContext.Provider value={value}>{children}</ComplianceContext.Provider>;
}

export function useCompliance(): ComplianceContextType {
  const ctx = useContext(ComplianceContext);
  if (!ctx) throw new Error('useCompliance must be used within ComplianceProvider');
  return ctx;
}
