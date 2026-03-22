import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { onboardingService } from '@/services/onboarding.service'
import Spinner from '@/components/common/Spinner'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import EmptyState from '@/components/common/EmptyState'
import toast from 'react-hot-toast'
import { CHECKLIST_CATEGORIES } from '@/types/onboarding.types'

interface TemplateItemForm {
  title: string
  description: string
  category: string
  assignee_role: string
  is_required: boolean
}

const emptyItem = (): TemplateItemForm => ({
  title: '', description: '', category: 'general', assignee_role: 'hr', is_required: true,
})

const ChecklistTemplateManager = () => {
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [items, setItems] = useState<TemplateItemForm[]>([emptyItem()])
  const qc = useQueryClient()

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['checklist-templates'],
    queryFn: () => onboardingService.getChecklistTemplates(),
  })

  const createMut = useMutation({
    mutationFn: () =>
      onboardingService.createChecklistTemplate({
        name,
        description: description || undefined,
        target_role: targetRole || undefined,
        items: items
          .filter((i) => i.title.trim())
          .map((i, idx) => ({
            title: i.title,
            description: i.description || undefined,
            category: i.category,
            assignee_role: i.assignee_role,
            sort_order: idx,
            is_required: i.is_required,
          })),
      }),
    onSuccess: () => {
      toast.success('Template created')
      setShowCreate(false)
      resetForm()
      qc.invalidateQueries({ queryKey: ['checklist-templates'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to create'),
  })

  const resetForm = () => {
    setName('')
    setDescription('')
    setTargetRole('')
    setItems([emptyItem()])
  }

  const addItem = () => setItems([...items, emptyItem()])
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx))
  const updateItem = (idx: number, field: keyof TemplateItemForm, value: string | boolean) =>
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Checklist Templates
        </h3>
        <Button
          leftIcon={<Plus size={14} />}
          onClick={() => setShowCreate(true)}
        >
          Create Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates"
          description="Create a checklist template to get started."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              Create Template
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div key={template.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {template.name}
                  </h4>
                  {template.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
                  )}
                </div>
                <Badge
                  label={template.is_active ? 'Active' : 'Inactive'}
                  className={template.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
                />
              </div>
              {template.target_role && (
                <p className="text-xs text-gray-400 mb-2">
                  Target: <span className="capitalize">{template.target_role}</span>
                </p>
              )}
              <div className="space-y-1.5 mt-3">
                {template.items.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <GripVertical size={12} className="text-gray-300" />
                    <span className="flex-1 truncate">{item.title}</span>
                    <Badge
                      label={item.category}
                      className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                    />
                    {item.is_required && <span className="text-red-500">*</span>}
                  </div>
                ))}
                {template.items.length > 5 && (
                  <p className="text-xs text-gray-400 pl-5">
                    +{template.items.length - 5} more items
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                {template.items.length} items · {template.items.filter((i) => i.is_required).length} required
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); resetForm() }}
        title="Create Checklist Template"
        size="xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Template Name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input w-full"
                placeholder="e.g. Standard Onboarding"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input w-full"
                placeholder="Optional description..."
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
                <option value="hr">HR</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Checklist Items
              </label>
              <Button size="sm" variant="ghost" leftIcon={<Plus size={14} />} onClick={addItem}>
                Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <input
                      value={item.title}
                      onChange={(e) => updateItem(idx, 'title', e.target.value)}
                      className="input flex-1"
                      placeholder="Item title *"
                    />
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    className="input w-full text-xs"
                    placeholder="Description (optional)"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={item.category}
                      onChange={(e) => updateItem(idx, 'category', e.target.value)}
                      className="input text-xs flex-1"
                    >
                      {CHECKLIST_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <select
                      value={item.assignee_role}
                      onChange={(e) => updateItem(idx, 'assignee_role', e.target.value)}
                      className="input text-xs flex-1"
                    >
                      <option value="hr">HR</option>
                      <option value="it">IT</option>
                      <option value="manager">Manager</option>
                      <option value="employee">Employee</option>
                      <option value="finance">Finance</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={item.is_required}
                        onChange={(e) => updateItem(idx, 'is_required', e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      Required
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm() }}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || items.every((i) => !i.title.trim())}
              loading={createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              Create Template
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ChecklistTemplateManager
