import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, FileCheck, AlertCircle } from 'lucide-react'
import { onboardingService } from '@/services/onboarding.service'
import Spinner from '@/components/common/Spinner'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import EmptyState from '@/components/common/EmptyState'
import toast from 'react-hot-toast'

const DOCUMENT_TYPES = [
  { value: 'pan_card',    label: 'PAN Card' },
  { value: 'aadhaar',     label: 'Aadhaar' },
  { value: 'passport',    label: 'Passport' },
  { value: 'bank_proof',  label: 'Bank Proof' },
  { value: 'education',   label: 'Education Certificate' },
  { value: 'experience',  label: 'Experience Letter' },
  { value: 'address_proof', label: 'Address Proof' },
  { value: 'photo',       label: 'Photograph' },
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'other',       label: 'Other' },
]

const DocumentRequirementsConfig = () => {
  const [showCreate, setShowCreate] = useState(false)
  const [docType, setDocType] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [isMandatory, setIsMandatory] = useState(true)
  const [hasExpiry, setHasExpiry] = useState(false)
  const qc = useQueryClient()

  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ['document-requirements'],
    queryFn: onboardingService.getDocumentRequirements,
  })

  const createMut = useMutation({
    mutationFn: () =>
      onboardingService.createDocumentRequirement({
        document_type: docType,
        name,
        description: description || undefined,
        target_role: targetRole || undefined,
        is_mandatory: isMandatory,
        has_expiry: hasExpiry,
      }),
    onSuccess: () => {
      toast.success('Requirement created')
      setShowCreate(false)
      resetForm()
      qc.invalidateQueries({ queryKey: ['document-requirements'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to create'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => onboardingService.deleteDocumentRequirement(id),
    onSuccess: () => {
      toast.success('Requirement deleted')
      qc.invalidateQueries({ queryKey: ['document-requirements'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to delete'),
  })

  const resetForm = () => {
    setDocType('')
    setName('')
    setDescription('')
    setTargetRole('')
    setIsMandatory(true)
    setHasExpiry(false)
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Document Requirements
        </h3>
        <Button leftIcon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
          Add Requirement
        </Button>
      </div>

      {requirements.length === 0 ? (
        <EmptyState
          title="No document requirements"
          description="Define which documents employees must submit during onboarding."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              Add Requirement
            </Button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Document</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Target</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Mandatory</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Expiry</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {requirements.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileCheck size={14} className="text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{req.name}</p>
                        {req.description && (
                          <p className="text-xs text-gray-400">{req.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {DOCUMENT_TYPES.find((t) => t.value === req.document_type)?.label || req.document_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {req.target_role || 'All'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {req.is_mandatory ? (
                      <Badge label="Mandatory" className="bg-red-100 text-red-700" />
                    ) : (
                      <Badge label="Optional" className="bg-gray-100 text-gray-500" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">
                      {req.has_expiry ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteMut.mutate(req.id)}
                      disabled={deleteMut.isPending}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); resetForm() }}
        title="Add Document Requirement"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Document Type *
            </label>
            <select
              value={docType}
              onChange={(e) => {
                setDocType(e.target.value)
                if (!name) {
                  const found = DOCUMENT_TYPES.find((t) => t.value === e.target.value)
                  if (found) setName(found.label)
                }
              }}
              className="input w-full"
            >
              <option value="">Select type...</option>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              placeholder="e.g. PAN Card"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input w-full"
              placeholder="Optional instructions..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Role
            </label>
            <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className="input w-full">
              <option value="">All Roles</option>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="intern">Intern</option>
            </select>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isMandatory}
                onChange={(e) => setIsMandatory(e.target.checked)}
                className="rounded text-blue-600"
              />
              Mandatory
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasExpiry}
                onChange={(e) => setHasExpiry(e.target.checked)}
                className="rounded text-blue-600"
              />
              Has Expiry Date
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm() }}>
              Cancel
            </Button>
            <Button
              disabled={!docType || !name.trim()}
              loading={createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              Add Requirement
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default DocumentRequirementsConfig
