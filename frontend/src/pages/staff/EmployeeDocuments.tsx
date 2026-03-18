import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Upload, FileCheck, Trash2, Download, ShieldCheck } from 'lucide-react'
import api from '@/services/api'
import { formatDate } from '@/utils/formatDate'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import EmptyState from '@/components/common/EmptyState'

interface Document {
  id: string
  employee_id: string
  document_type: string
  filename: string
  file_path: string
  notes?: string
  verified: boolean
  verified_by?: string
  verified_at?: string
  created_at: string
}

const DOC_TYPES = [
  { value: 'offer_letter',  label: 'Offer Letter' },
  { value: 'id_proof',      label: 'ID Proof' },
  { value: 'certificate',   label: 'Certificate' },
  { value: 'nda',           label: 'NDA' },
  { value: 'other',         label: 'Other' },
]

const DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(DOC_TYPES.map(d => [d.value, d.label]))

export const EmployeeDocuments = ({ employeeId, canAdmin }: { employeeId: string; canAdmin: boolean }) => {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [docType, setDocType] = useState('offer_letter')
  const [notes, setNotes]     = useState('')

  const { data: docs = [], isLoading } = useQuery<Document[]>({
    queryKey: ['documents', employeeId],
    queryFn: () => api.get<Document[]>('/api/documents', { params: { employee_id: employeeId } }).then(r => r.data),
  })

  const { mutate: upload, isPending: uploading } = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      form.append('employee_id', employeeId)
      form.append('document_type', docType)
      if (notes) form.append('notes', notes)
      return api.post<Document>('/api/documents', form).then(r => r.data)
    },
    onSuccess: () => {
      toast.success('Document uploaded')
      qc.invalidateQueries({ queryKey: ['documents', employeeId] })
      setNotes('')
      if (fileRef.current) fileRef.current.value = ''
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Upload failed'),
  })

  const { mutate: verify } = useMutation({
    mutationFn: (id: string) => api.patch<Document>(`/api/documents/${id}/verify`).then(r => r.data),
    onSuccess: () => {
      toast.success('Document verified')
      qc.invalidateQueries({ queryKey: ['documents', employeeId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => api.delete(`/api/documents/${id}`).then(r => r.data),
    onSuccess: () => {
      toast.success('Document deleted')
      qc.invalidateQueries({ queryKey: ['documents', employeeId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  const ALLOWED_TYPES = [
    'application/pdf', 'image/jpeg', 'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Only PDF, JPEG, PNG, DOC files allowed')
      return
    }
    if (file.size > MAX_SIZE) {
      toast.error('File size must be under 10MB')
      return
    }
    upload(file)
  }

  if (isLoading) return <div className="animate-pulse h-32 bg-gray-100 dark:bg-gray-800 rounded-xl" />

  return (
    <div className="space-y-4">
      {/* Upload bar */}
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
            bg-white dark:bg-gray-900 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <input
          type="text"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
            bg-white dark:bg-gray-900 text-gray-900 dark:text-white
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
        <Button
          leftIcon={<Upload size={14} />}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          loading={uploading}
        >
          Upload
        </Button>
      </div>

      {/* Document list */}
      {docs.length === 0 ? (
        <EmptyState
          icon={<FileCheck size={36} className="text-gray-300" />}
          title="No documents"
          description="Upload offer letters, ID proofs, certificates and more."
        />
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-700">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
              <FileCheck size={16} className="text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{doc.filename}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                  {doc.notes && ` · ${doc.notes}`}
                  {' · '}{formatDate(doc.created_at, 'MMM d, yyyy')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {doc.verified ? (
                  <Badge label="Verified" className="bg-green-100 text-green-700" />
                ) : (
                  <Badge label="Pending" className="bg-amber-100 text-amber-700" />
                )}
                <a href={doc.file_path} target="_blank" rel="noreferrer"
                   className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                  <Download size={14} />
                </a>
                {canAdmin && !doc.verified && (
                  <button onClick={() => verify(doc.id)}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                    title="Verify document">
                    <ShieldCheck size={14} />
                  </button>
                )}
                {canAdmin && (
                  <button onClick={() => remove(doc.id)}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete document">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default EmployeeDocuments
