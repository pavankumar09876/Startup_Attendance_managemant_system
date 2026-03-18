import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const shortcuts = [
  { keys: 'Ctrl + K',  description: 'Open command palette' },
  { keys: 'Shift + ?', description: 'Show keyboard shortcuts' },
  { keys: 'G → D',     description: 'Go to Dashboard' },
  { keys: 'G → A',     description: 'Go to Attendance' },
  { keys: 'G → L',     description: 'Go to Leave' },
  { keys: 'G → P',     description: 'Go to Projects' },
  { keys: 'G → S',     description: 'Go to Staff' },
  { keys: 'Esc',       description: 'Close modal / palette' },
]

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && e.shiftKey && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Keyboard Shortcuts</h2>
          <button onClick={() => setOpen(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-3 space-y-1">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">{s.description}</span>
              <kbd className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 text-center">
          Press <kbd className="font-mono">Shift + ?</kbd> to toggle this panel
        </div>
      </div>
    </div>
  )
}
