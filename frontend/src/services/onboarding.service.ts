import api from './api'
import type {
  StatusTransition, BGV, BGVItem,
  ChecklistTemplate, EmployeeChecklist, EmployeeChecklistItem,
  PendingRequest, ApprovalStep,
  DocumentRequirement, RequiredDocumentStatus,
  JoiningInstruction, EmployeeJoiningDetail,
  OnboardingDashboard, PipelineEmployee,
  SLAConfig, SLABreach, BulkTransitionResult,
} from '@/types/onboarding.types'
import type { TokenResponse } from '@/types/user.types'

const BASE = '/api/onboarding'

export const onboardingService = {
  // ── Status Transitions ──────────────────────────────────────────────────────
  transitionStatus: (employeeId: string, newStatus: string, notes?: string) =>
    api.post<StatusTransition>(`${BASE}/employees/${employeeId}/transition`, {
      new_status: newStatus, notes,
    }).then((r) => r.data),

  getTransitions: (employeeId: string) =>
    api.get<StatusTransition[]>(`${BASE}/employees/${employeeId}/transitions`).then((r) => r.data),

  // ── BGV ──────────────────────────────────────────────────────────────────────
  initiateBGV: (employeeId: string, data: { vendor_name?: string; notes?: string; items?: { item_type: string; notes?: string }[] }) =>
    api.post<BGV>(`${BASE}/employees/${employeeId}/bgv`, data).then((r) => r.data),

  getBGV: (employeeId: string) =>
    api.get<BGV | null>(`${BASE}/employees/${employeeId}/bgv`).then((r) => r.data),

  updateBGVItem: (itemId: string, data: { status: string; result?: string; verified_by?: string; notes?: string }) =>
    api.patch<BGVItem>(`${BASE}/bgv-items/${itemId}`, data).then((r) => r.data),

  // ── Checklist Templates ─────────────────────────────────────────────────────
  getChecklistTemplates: (params?: { role?: string; department_id?: string }) =>
    api.get<ChecklistTemplate[]>(`${BASE}/checklist-templates`, { params }).then((r) => r.data),

  createChecklistTemplate: (data: {
    name: string; description?: string; target_role?: string; target_department_id?: string;
    items?: { title: string; description?: string; category?: string; assignee_role?: string; sort_order?: number; is_required?: boolean }[];
  }) =>
    api.post<ChecklistTemplate>(`${BASE}/checklist-templates`, data).then((r) => r.data),

  // ── Per-Employee Checklists ─────────────────────────────────────────────────
  assignChecklist: (employeeId: string, templateId: string) =>
    api.post<EmployeeChecklistItem[]>(`${BASE}/employees/${employeeId}/checklist?template_id=${templateId}`).then((r) => r.data),

  getEmployeeChecklist: (employeeId: string) =>
    api.get<EmployeeChecklist>(`${BASE}/employees/${employeeId}/checklist`).then((r) => r.data),

  updateChecklistItem: (itemId: string, data: { is_completed?: boolean; notes?: string }) =>
    api.patch<EmployeeChecklistItem>(`${BASE}/checklist-items/${itemId}`, data).then((r) => r.data),

  // ── Invite ──────────────────────────────────────────────────────────────────
  sendInvite: (employeeId: string) =>
    api.post<{ message: string; invite_url: string }>(`${BASE}/employees/${employeeId}/invite`).then((r) => r.data),

  acceptInvite: (token: string, newPassword: string) =>
    api.post<TokenResponse>('/api/auth/accept-invite', { token, new_password: newPassword }).then((r) => r.data),

  // ── Multi-Step Approvals ────────────────────────────────────────────────────
  createRequest: (data: { employee_data: Record<string, unknown>; approval_chain: { level: number; role: string }[] }) =>
    api.post<{ id: string; status: string }>(`${BASE}/requests`, data).then((r) => r.data),

  getRequests: (status?: string) =>
    api.get<PendingRequest[]>(`${BASE}/requests`, { params: status ? { status } : undefined }).then((r) => r.data),

  getRequestDetail: (requestId: string) =>
    api.get<PendingRequest>(`${BASE}/requests/${requestId}`).then((r) => r.data),

  approveRequest: (requestId: string, comment?: string) =>
    api.post(`${BASE}/requests/${requestId}/approve`, { comment }).then((r) => r.data),

  rejectRequest: (requestId: string, reason: string) =>
    api.post(`${BASE}/requests/${requestId}/reject`, { reason }).then((r) => r.data),

  // ── Document Requirements ───────────────────────────────────────────────────
  getDocumentRequirements: () =>
    api.get<DocumentRequirement[]>(`${BASE}/document-requirements`).then((r) => r.data),

  createDocumentRequirement: (data: {
    document_type: string; name: string; description?: string;
    target_role?: string; target_department_id?: string;
    is_mandatory?: boolean; has_expiry?: boolean;
  }) =>
    api.post<DocumentRequirement>(`${BASE}/document-requirements`, data).then((r) => r.data),

  deleteDocumentRequirement: (id: string) =>
    api.delete(`${BASE}/document-requirements/${id}`).then((r) => r.data),

  getEmployeeRequiredDocuments: (employeeId: string) =>
    api.get<RequiredDocumentStatus[]>(`${BASE}/employees/${employeeId}/required-documents`).then((r) => r.data),

  // ── Joining Instructions ────────────────────────────────────────────────────
  getJoiningTemplates: () =>
    api.get<JoiningInstruction[]>(`${BASE}/joining-templates`).then((r) => r.data),

  createJoiningTemplate: (data: {
    name: string; subject: string; body_html: string;
    target_role?: string; target_department_id?: string;
  }) =>
    api.post<JoiningInstruction>(`${BASE}/joining-templates`, data).then((r) => r.data),

  sendJoiningInstructions: (employeeId: string) =>
    api.post(`${BASE}/employees/${employeeId}/send-joining-instructions`).then((r) => r.data),

  getJoiningDetails: (employeeId: string) =>
    api.get<EmployeeJoiningDetail | null>(`${BASE}/employees/${employeeId}/joining-details`).then((r) => r.data),

  setJoiningDetails: (employeeId: string, data: {
    first_day_schedule?: string; reporting_location?: string; reporting_time?: string;
  }) =>
    api.post<EmployeeJoiningDetail>(`${BASE}/employees/${employeeId}/joining-details`, data).then((r) => r.data),

  // ── Dashboard & Pipeline ────────────────────────────────────────────────────
  getDashboard: () =>
    api.get<OnboardingDashboard>(`${BASE}/dashboard`).then((r) => r.data),

  getPipeline: (status?: string) =>
    api.get<PipelineEmployee[]>(`${BASE}/pipeline`, { params: status ? { status } : undefined }).then((r) => r.data),

  // ── SLA Configuration ─────────────────────────────────────────────────────
  getSLAConfigs: () =>
    api.get<SLAConfig[]>(`${BASE}/sla-configs`).then((r) => r.data),

  createSLAConfig: (data: { stage: string; max_days: number; escalation_role?: string; auto_notify?: boolean }) =>
    api.post<SLAConfig>(`${BASE}/sla-configs`, data).then((r) => r.data),

  updateSLAConfig: (id: string, data: { max_days?: number; escalation_role?: string; auto_notify?: boolean; is_active?: boolean }) =>
    api.patch<SLAConfig>(`${BASE}/sla-configs/${id}`, data).then((r) => r.data),

  deleteSLAConfig: (id: string) =>
    api.delete(`${BASE}/sla-configs/${id}`).then((r) => r.data),

  // ── SLA Breaches ──────────────────────────────────────────────────────────
  getSLABreaches: (params?: { stage?: string; resolved?: boolean }) =>
    api.get<SLABreach[]>(`${BASE}/sla-breaches`, { params }).then((r) => r.data),

  resolveSLABreach: (breachId: string, notes?: string) =>
    api.post<SLABreach>(`${BASE}/sla-breaches/${breachId}/resolve`, null, { params: notes ? { notes } : undefined }).then((r) => r.data),

  // ── Bulk Operations ───────────────────────────────────────────────────────
  bulkTransition: (employeeIds: string[], newStatus: string, notes?: string) =>
    api.post<BulkTransitionResult>(`${BASE}/bulk-transition`, {
      employee_ids: employeeIds, new_status: newStatus, notes,
    }).then((r) => r.data),
}
