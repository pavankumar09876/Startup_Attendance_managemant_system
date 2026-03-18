import api from './api'
import type { PayrollEntry, PayrollSummary, Expense, CreateExpensePayload } from '@/types/payroll.types'

export const payrollService = {
  // ── Payroll ───────────────────────────────────────────────────────────────
  getSummary: (month: number, year: number) =>
    api
      .get<PayrollSummary>('/api/payroll/summary', { params: { month, year } })
      .then((r) => r.data),

  getEntries: (month: number, year: number) =>
    api
      .get<PayrollEntry[]>('/api/payroll/entries', { params: { month, year } })
      .then((r) => r.data),

  previewPayroll: (month: number, year: number) =>
    api
      .get<PayrollEntry[]>('/api/payroll/preview', { params: { month, year } })
      .then((r) => r.data),

  runPayroll: (month: number, year: number) =>
    api
      .post<{ message: string; count: number }>('/api/payroll/run', { month, year })
      .then((r) => r.data),

  markAsPaid: (entryId: string) =>
    api.patch<PayrollEntry>(`/api/payroll/entries/${entryId}/mark-paid`).then((r) => r.data),

  markAllAsPaid: (month: number, year: number) =>
    api
      .post('/api/payroll/mark-all-paid', { month, year })
      .then((r) => r.data),

  exportCSV: (month: number, year: number) =>
    api
      .get('/api/payroll/export', { params: { month, year }, responseType: 'blob' })
      .then((r) => r.data),

  // ── Payslips ──────────────────────────────────────────────────────────────
  getMyPayslips: () =>
    api.get<PayrollEntry[]>('/api/payroll/my').then((r) => r.data),

  getPayslip: (id: string) =>
    api.get<PayrollEntry>(`/api/payroll/payslips/${id}`).then((r) => r.data),

  downloadPayslip: (id: string) =>
    api
      .get(`/api/payroll/payslips/${id}/pdf`, { responseType: 'blob' })
      .then((r) => r.data),

  allocateLeaveBalances: (year: number) =>
    api.post<{ allocated: number; year: number }>('/api/payroll/leave-balances/allocate', null, { params: { year } })
       .then((r) => r.data),

  // ── Expenses ──────────────────────────────────────────────────────────────
  getMyExpenses: () =>
    api.get<Expense[]>('/api/expenses/my').then((r) => r.data),

  getPendingExpenses: () =>
    api.get<Expense[]>('/api/expenses/pending').then((r) => r.data),

  submitExpense: (payload: CreateExpensePayload) =>
    api.post<Expense>('/api/expenses', payload).then((r) => r.data),

  uploadReceipt: (expenseId: string, file: File) => {
    const form = new FormData()
    form.append('receipt', file)
    return api
      .post<{ receipt_url: string }>(`/api/expenses/${expenseId}/receipt`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  approveExpense: (id: string) =>
    api.patch<Expense>(`/api/expenses/${id}/approve`).then((r) => r.data),

  rejectExpense: (id: string, reason?: string) =>
    api.patch<Expense>(`/api/expenses/${id}/reject`, { reason }).then((r) => r.data),

  cancelExpense: (id: string) =>
    api.delete(`/api/expenses/${id}`).then((r) => r.data),
}
