/**
 * BulkImportModal — upload a CSV to import multiple employees at once.
 * Provides CSV template download, file upload with preview, then submits row-by-row.
 */
import { useState, useRef } from 'react'
import { X, Upload, Download, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { staffService } from '@/services/staff.service'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

interface Props {
  open: boolean
  onClose: () => void
}

interface CSVRow {
  first_name:     string
  last_name:      string
  email:          string
  phone:          string
  designation:    string
  department:     string
  role:           string
  salary:         string
  date_of_joining: string
  employment_type: string
}

type RowStatus = 'pending' | 'success' | 'error'

interface ParsedRow extends CSVRow {
  _status:  RowStatus
  _error?:  string
  _index:   number
}

const TEMPLATE_HEADERS = [
  'first_name', 'last_name', 'email', 'phone', 'designation',
  'department', 'role', 'salary', 'date_of_joining', 'employment_type',
]

const downloadTemplate = () => {
  const example = TEMPLATE_HEADERS.join(',') + '\n' +
    'John,Doe,john.doe@company.com,9876543210,Software Engineer,Engineering,employee,50000,2024-01-15,full_time\n' +
    'Jane,Smith,jane.smith@company.com,9123456789,Product Manager,Product,manager,80000,2024-02-01,full_time'
  const blob = new Blob([example], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'employee_import_template.csv'; a.click()
  URL.revokeObjectURL(url)
}

const parseCSV = (text: string): ParsedRow[] => {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''))
  return lines.slice(1).map((line, i) => {
    const values = line.split(',').map((v) => v.trim().replace(/"/g, ''))
    const row: any = { _status: 'pending', _index: i + 1 }
    headers.forEach((h, hi) => { row[h] = values[hi] ?? '' })
    // Validate required fields
    if (!row.first_name || !row.last_name || !row.email) {
      row._status = 'error'
      row._error  = 'Missing required fields (first_name, last_name, email)'
    }
    return row as ParsedRow
  })
}

const BulkImportModal = ({ open, onClose }: Props) => {
  if (!open) return null
  const fileRef    = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [rows,       setRows]       = useState<ParsedRow[]>([])
  const [importing,  setImporting]  = useState(false)
  const [done,       setDone]       = useState(false)

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setRows(parseCSV(text))
      setDone(false)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) handleFile(file)
  }

  const pendingRows = rows.filter((r) => r._status === 'pending')
  const successRows = rows.filter((r) => r._status === 'success')
  const errorRows   = rows.filter((r) => r._status === 'error')

  const runImport = async () => {
    setImporting(true)
    let successCount = 0
    for (const row of rows.filter((r) => r._status === 'pending')) {
      try {
        await staffService.createEmployee({
          first_name:      row.first_name,
          last_name:       row.last_name,
          email:           row.email,
          phone:           row.phone,
          designation:     row.designation,
          role:            (row.role || 'employee') as any,
          salary:          row.salary ? parseFloat(row.salary) : undefined,
          date_of_joining: row.date_of_joining || undefined,
          employment_type: (row.employment_type || 'full_time') as any,
          password:        'Temp@1234',   // initial password
        } as any)
        setRows((prev) => prev.map((r) => r._index === row._index ? { ...r, _status: 'success' } : r))
        successCount++
      } catch (err: any) {
        const msg = err?.response?.data?.detail ?? 'Import failed'
        setRows((prev) => prev.map((r) => r._index === row._index ? { ...r, _status: 'error', _error: msg } : r))
      }
    }
    setImporting(false)
    setDone(true)
    if (successCount > 0) {
      toast.success(`${successCount} employees imported successfully!`)
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-3xl
        max-h-[85vh] flex flex-col overflow-hidden z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Bulk Import Employees</h2>
            <p className="text-xs text-gray-400 mt-0.5">Upload a CSV file to add multiple employees at once</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Template download */}
          <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-xl">
            <Download size={16} className="text-blue-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Need the template?</p>
              <p className="text-xs text-blue-500">Download our CSV template with sample data</p>
            </div>
            <Button variant="secondary" size="sm" onClick={downloadTemplate} leftIcon={<Download size={12} />}>
              Download
            </Button>
          </div>

          {/* Drop zone */}
          {rows.length === 0 && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-10
                flex flex-col items-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
            >
              <Upload size={28} className="text-gray-300" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop CSV here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">Only .csv files are accepted</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {rows.length} rows found
                  {errorRows.length > 0 && (
                    <span className="ml-2 text-red-500">{errorRows.length} with errors</span>
                  )}
                  {successRows.length > 0 && (
                    <span className="ml-2 text-green-500">{successRows.length} imported</span>
                  )}
                </p>
                {!done && (
                  <Button variant="ghost" size="sm" onClick={() => { setRows([]); setDone(false) }}>
                    Clear
                  </Button>
                )}
              </div>
              <div className="overflow-auto max-h-64 rounded-xl border border-gray-100 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500">#</th>
                      <th className="px-3 py-2 text-left text-gray-500">Name</th>
                      <th className="px-3 py-2 text-left text-gray-500">Email</th>
                      <th className="px-3 py-2 text-left text-gray-500">Role</th>
                      <th className="px-3 py-2 text-left text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {rows.map((row) => (
                      <tr key={row._index} className={cn(
                        row._status === 'error'   ? 'bg-red-50 dark:bg-red-950' :
                        row._status === 'success' ? 'bg-green-50 dark:bg-green-950' : '',
                      )}>
                        <td className="px-3 py-2 text-gray-400">{row._index}</td>
                        <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">
                          {row.first_name} {row.last_name}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{row.email}</td>
                        <td className="px-3 py-2 text-gray-500 capitalize">{row.role || 'employee'}</td>
                        <td className="px-3 py-2">
                          {row._status === 'pending' && <span className="text-gray-400">Pending</span>}
                          {row._status === 'success' && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 size={12} /> Imported
                            </span>
                          )}
                          {row._status === 'error' && (
                            <span className="flex items-center gap-1 text-red-500" title={row._error}>
                              <XCircle size={12} /> {row._error?.slice(0, 30)}…
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {rows.length > 0 && !done && (
            <Button
              onClick={runImport}
              loading={importing}
              disabled={pendingRows.length === 0}
              leftIcon={importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            >
              Import {pendingRows.length} Employees
            </Button>
          )}
          {done && (
            <Button onClick={onClose}>
              Done — {successRows.length} imported
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default BulkImportModal
