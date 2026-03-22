import type { EmployeeStatus } from './user.types'

// ── Status Transitions ──────────────────────────────────────────────────────

export interface StatusTransition {
  id: string
  employee_id: string
  from_status: string | null
  to_status: string
  transitioned_by: string
  notes?: string
  created_at: string
}

// ── BGV ─────────────────────────────────────────────────────────────────────

export type BGVStatus = 'pending' | 'in_verification' | 'cleared' | 'failed'
export type BGVItemStatus = 'pending' | 'in_progress' | 'verified' | 'failed' | 'not_applicable'

export interface BGVItem {
  id: string
  bgv_id: string
  item_type: string
  status: BGVItemStatus
  result?: string
  verified_by?: string
  verified_at?: string
  notes?: string
  created_at: string
}

export interface BGV {
  id: string
  employee_id: string
  status: BGVStatus
  overall_result?: string
  vendor_name?: string
  initiated_by?: string
  initiated_at?: string
  completed_at?: string
  notes?: string
  items: BGVItem[]
  created_at: string
}

// ── Checklists ──────────────────────────────────────────────────────────────

export interface ChecklistTemplateItem {
  id: string
  template_id: string
  title: string
  description?: string
  category: string
  assignee_role: string
  sort_order: number
  is_required: boolean
  created_at: string
}

export interface ChecklistTemplate {
  id: string
  name: string
  description?: string
  target_role?: string
  target_department_id?: string
  is_active: boolean
  items: ChecklistTemplateItem[]
  created_at: string
}

export interface EmployeeChecklistItem {
  id: string
  employee_id: string
  template_item_id?: string
  title: string
  description?: string
  category: string
  assignee_role: string
  assignee_id?: string
  is_completed: boolean
  completed_by?: string
  completed_at?: string
  sort_order: number
  is_required: boolean
  due_date?: string
  notes?: string
  created_at: string
}

export interface ChecklistProgress {
  total: number
  completed: number
  required_total: number
  required_completed: number
  percentage: number
}

export interface EmployeeChecklist {
  items: EmployeeChecklistItem[]
  progress: ChecklistProgress
}

// ── Approval Steps ──────────────────────────────────────────────────────────

export type ApprovalStepStatus = 'pending' | 'approved' | 'rejected' | 'skipped'

export interface ApprovalStep {
  id: string
  level: number
  approver_role: string
  approver_id?: string
  status: ApprovalStepStatus
  comment?: string
  acted_at?: string
}

export interface PendingRequest {
  id: string
  payload?: Record<string, unknown>
  status: string
  current_approval_level: number
  max_approval_level: number
  requested_by: string
  created_at: string
  steps?: ApprovalStep[]
}

// ── Document Requirements ───────────────────────────────────────────────────

export interface DocumentRequirement {
  id: string
  document_type: string
  name: string
  description?: string
  target_role?: string
  target_department_id?: string
  is_mandatory: boolean
  has_expiry: boolean
  created_at: string
}

export interface RequiredDocumentStatus {
  requirement: DocumentRequirement
  submitted: boolean
  document_id?: string
  verified: boolean
}

// ── Joining ─────────────────────────────────────────────────────────────────

export interface JoiningInstruction {
  id: string
  name: string
  subject: string
  body_html: string
  target_role?: string
  target_department_id?: string
  is_active: boolean
  created_at: string
}

export interface EmployeeJoiningDetail {
  id: string
  employee_id: string
  first_day_schedule?: string
  reporting_location?: string
  reporting_time?: string
  reporting_manager_notified: boolean
  joining_kit_sent: boolean
  instructions_sent_at?: string
  created_at: string
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export interface PipelineStage {
  status: string
  label: string
  count: number
}

export interface OnboardingDashboard {
  pipeline: PipelineStage[]
  total_onboarding: number
  bgv_pending: number
  bgv_cleared: number
  bgv_failed: number
  checklist_avg_progress: number
  pending_approvals: number
}

export interface PipelineEmployee {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  email: string
  role: string
  status: EmployeeStatus
  department_id?: string
  designation?: string
  created_at: string
}

// ── SLA Configuration ──────────────────────────────────────────────────────

export interface SLAConfig {
  id: string
  stage: string
  max_days: number
  escalation_role?: string
  auto_notify: boolean
  is_active: boolean
  created_at: string
}

export interface SLABreach {
  id: string
  employee_id: string
  stage: string
  sla_days: number
  actual_days: number
  breached_at: string
  resolved_at?: string
  escalated_to?: string
  notes?: string
  created_at: string
}

// ── Bulk Operations ────────────────────────────────────────────────────────

export interface BulkTransitionResult {
  succeeded: number
  failed: { employee_id: string; error: string }[]
  total: number
}

// ── Status labels & colors ──────────────────────────────────────────────────

export const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  offer_sent:      'Offer Sent',
  offer_accepted:  'Offer Accepted',
  pre_onboarding:  'Pre-Onboarding',
  joined:          'Joined',
  invited:         'Invited',
  active:          'Active',
  training:        'Training',
  bench:           'Bench',
  suspended:       'Suspended',
  terminated:      'Terminated',
}

export const EMPLOYEE_STATUS_COLORS: Record<string, string> = {
  offer_sent:      'bg-indigo-100 text-indigo-700',
  offer_accepted:  'bg-cyan-100 text-cyan-700',
  pre_onboarding:  'bg-amber-100 text-amber-700',
  joined:          'bg-lime-100 text-lime-700',
  invited:         'bg-blue-100 text-blue-700',
  active:          'bg-green-100 text-green-700',
  training:        'bg-violet-100 text-violet-700',
  bench:           'bg-orange-100 text-orange-700',
  suspended:       'bg-red-100 text-red-700',
  terminated:      'bg-gray-100 text-gray-600',
}

export const BGV_STATUS_COLORS: Record<string, string> = {
  pending:           'bg-yellow-100 text-yellow-700',
  in_verification:   'bg-blue-100 text-blue-700',
  cleared:           'bg-green-100 text-green-700',
  failed:            'bg-red-100 text-red-700',
}

export const BGV_ITEM_TYPES = [
  { value: 'employment_history', label: 'Employment History' },
  { value: 'education',          label: 'Education' },
  { value: 'criminal_record',    label: 'Criminal Record' },
  { value: 'address',            label: 'Address' },
  { value: 'identity',           label: 'Identity' },
]

export const CHECKLIST_CATEGORIES = [
  { value: 'hr',       label: 'HR' },
  { value: 'it',       label: 'IT' },
  { value: 'employee', label: 'Employee' },
  { value: 'finance',  label: 'Finance' },
  { value: 'general',  label: 'General' },
]
