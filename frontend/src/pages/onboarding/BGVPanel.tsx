import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Search, Plus, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { onboardingService } from '@/services/onboarding.service'
import Spinner from '@/components/common/Spinner'
import Badge from '@/components/common/Badge'
import Avatar from '@/components/common/Avatar'
import EmptyState from '@/components/common/EmptyState'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import toast from 'react-hot-toast'
import {
  BGV_STATUS_COLORS, BGV_ITEM_TYPES,
} from '@/types/onboarding.types'
import type { PipelineEmployee, BGV } from '@/types/onboarding.types'

const BGV_ITEM_STATUS_COLORS: Record<string, string> = {
  pending:       'bg-yellow-100 text-yellow-700',
  in_progress:   'bg-blue-100 text-blue-700',
  verified:      'bg-green-100 text-green-700',
  failed:        'bg-red-100 text-red-700',
  not_applicable:'bg-gray-100 text-gray-500',
}

const BGVPanel = () => {
  const [search, setSearch] = useState('')
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null)
  const [showInitiate, setShowInitiate] = useState(false)
  const [initiateEmpId, setInitiateEmpId] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [bgvNotes, setBgvNotes] = useState('')
  const [selectedItems, setSelectedItems] = useState<string[]>(
    BGV_ITEM_TYPES.map((t) => t.value),
  )
  const qc = useQueryClient()

  // Get pipeline employees to find ones we can run BGV on
  const { data: employees = [], isLoading: loadingPipeline } = useQuery({
    queryKey: ['onboarding-pipeline'],
    queryFn: () => onboardingService.getPipeline(),
  })

  // Get BGV for selected employee
  const { data: bgvData, isLoading: loadingBGV } = useQuery({
    queryKey: ['bgv', selectedEmpId],
    queryFn: () => onboardingService.getBGV(selectedEmpId!),
    enabled: !!selectedEmpId,
  })

  const initiateMut = useMutation({
    mutationFn: () =>
      onboardingService.initiateBGV(initiateEmpId, {
        vendor_name: vendorName || undefined,
        notes: bgvNotes || undefined,
        items: selectedItems.map((t) => ({ item_type: t })),
      }),
    onSuccess: () => {
      toast.success('BGV initiated')
      setShowInitiate(false)
      setInitiateEmpId('')
      setVendorName('')
      setBgvNotes('')
      qc.invalidateQueries({ queryKey: ['bgv'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to initiate BGV'),
  })

  const updateItemMut = useMutation({
    mutationFn: ({ itemId, status, result, notes }: { itemId: string; status: string; result?: string; notes?: string }) =>
      onboardingService.updateBGVItem(itemId, { status, result, notes }),
    onSuccess: () => {
      toast.success('Item updated')
      qc.invalidateQueries({ queryKey: ['bgv', selectedEmpId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Update failed'),
  })

  const filtered = employees.filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.first_name.toLowerCase().includes(q) ||
      e.last_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q)
    )
  })

  const onboardingStatuses = ['offer_sent', 'offer_accepted', 'pre_onboarding', 'joined']
  const bgvEligible = filtered.filter((e) => onboardingStatuses.includes(e.status))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <Button
          leftIcon={<Plus size={14} />}
          onClick={() => setShowInitiate(true)}
        >
          Initiate BGV
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Employee list */}
        <div className="card p-4 lg:col-span-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Employees in Pipeline
          </h3>
          {loadingPipeline ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : bgvEligible.length === 0 ? (
            <EmptyState title="No employees" description="No onboarding employees found." compact />
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
              {bgvEligible.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmpId(emp.id)}
                  className={`w-full flex items-center gap-3 py-3 px-2 rounded-lg text-left transition-colors ${
                    selectedEmpId === emp.id
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Avatar name={`${emp.first_name} ${emp.last_name}`} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {emp.first_name} {emp.last_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{emp.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* BGV Detail */}
        <div className="card p-4 lg:col-span-2">
          {!selectedEmpId ? (
            <EmptyState
              icon={<Shield size={36} className="text-gray-300" />}
              title="Select an employee"
              description="Click an employee to view their BGV status."
            />
          ) : loadingBGV ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : !bgvData ? (
            <EmptyState
              icon={<Shield size={36} className="text-gray-300" />}
              title="No BGV initiated"
              description="Use the 'Initiate BGV' button to start background verification."
            />
          ) : (
            <BGVDetail
              bgv={bgvData}
              onUpdateItem={(itemId, status) => updateItemMut.mutate({ itemId, status })}
              updating={updateItemMut.isPending}
            />
          )}
        </div>
      </div>

      {/* Initiate BGV Modal */}
      <Modal
        open={showInitiate}
        onClose={() => setShowInitiate(false)}
        title="Initiate Background Verification"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee</label>
            <select
              value={initiateEmpId}
              onChange={(e) => setInitiateEmpId(e.target.value)}
              className="input w-full"
            >
              <option value="">Select employee...</option>
              {bgvEligible.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name} — {e.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor Name</label>
            <input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="input w-full"
              placeholder="e.g. AuthBridge, HireRight"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Verification Items
            </label>
            <div className="grid grid-cols-2 gap-2">
              {BGV_ITEM_TYPES.map((type) => (
                <label key={type.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(type.value)}
                    onChange={(e) =>
                      setSelectedItems((prev) =>
                        e.target.checked
                          ? [...prev, type.value]
                          : prev.filter((v) => v !== type.value),
                      )
                    }
                    className="rounded text-blue-600"
                  />
                  {type.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={bgvNotes}
              onChange={(e) => setBgvNotes(e.target.value)}
              rows={2}
              className="input w-full"
              placeholder="Additional notes..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowInitiate(false)}>Cancel</Button>
            <Button
              disabled={!initiateEmpId || selectedItems.length === 0}
              loading={initiateMut.isPending}
              onClick={() => initiateMut.mutate()}
            >
              Initiate BGV
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

const BGVDetail = ({
  bgv,
  onUpdateItem,
  updating,
}: {
  bgv: BGV
  onUpdateItem: (itemId: string, status: string) => void
  updating: boolean
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Background Verification
        </h3>
        {bgv.vendor_name && (
          <p className="text-xs text-gray-500 mt-0.5">Vendor: {bgv.vendor_name}</p>
        )}
      </div>
      <Badge
        label={bgv.status.replace(/_/g, ' ')}
        className={BGV_STATUS_COLORS[bgv.status] || 'bg-gray-100 text-gray-600'}
      />
    </div>

    {bgv.notes && (
      <p className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">{bgv.notes}</p>
    )}

    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {bgv.items.map((item) => (
        <div key={item.id} className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            {item.status === 'verified' ? (
              <CheckCircle2 size={16} className="text-green-500" />
            ) : item.status === 'failed' ? (
              <XCircle size={16} className="text-red-500" />
            ) : (
              <Clock size={16} className="text-amber-500" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {BGV_ITEM_TYPES.find((t) => t.value === item.item_type)?.label || item.item_type}
              </p>
              {item.result && (
                <p className="text-xs text-gray-500">{item.result}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              label={item.status.replace(/_/g, ' ')}
              className={BGV_ITEM_STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-600'}
            />
            {!['verified', 'failed', 'not_applicable'].includes(item.status) && (
              <div className="flex gap-1">
                <button
                  onClick={() => onUpdateItem(item.id, 'verified')}
                  disabled={updating}
                  className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                  title="Mark Verified"
                >
                  <CheckCircle2 size={16} />
                </button>
                <button
                  onClick={() => onUpdateItem(item.id, 'failed')}
                  disabled={updating}
                  className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  title="Mark Failed"
                >
                  <XCircle size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
)

export default BGVPanel
