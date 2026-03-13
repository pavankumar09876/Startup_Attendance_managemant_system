import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, FolderKanban, CheckSquare, ArrowRight, Loader2 } from 'lucide-react'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import api from '@/services/api'
import { cn } from '@/utils/cn'

interface SearchResult {
  id:       string
  type:     'employee' | 'project' | 'task'
  title:    string
  subtitle: string
  link:     string
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  employee: <Users      size={14} className="text-blue-500" />,
  project:  <FolderKanban size={14} className="text-purple-500" />,
  task:     <CheckSquare size={14} className="text-green-500" />,
}

const TYPE_LABEL: Record<string, string> = {
  employee: 'Employee',
  project:  'Project',
  task:     'Task',
}

let searchTimeout: ReturnType<typeof setTimeout>

const CommandPalette = () => {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [active,  setActive]  = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Ctrl+K / Cmd+K to open
  useKeyboardShortcut({
    ctrl: true,
    key: 'k',
    handler: () => { setOpen(true); setQuery(''); setResults([]) },
  })

  // Escape to close
  useKeyboardShortcut({
    key: 'Escape',
    handler: () => setOpen(false),
    enabled: open,
  })

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const search = useCallback((q: string) => {
    clearTimeout(searchTimeout)
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    searchTimeout = setTimeout(async () => {
      try {
        const res = await api.get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`)
        setResults(res.data.results)
        setActive(0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 200)
  }, [])

  const handleSelect = (item: SearchResult) => {
    navigate(item.link)
    setOpen(false)
    setQuery('')
    setResults([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && results[active]) {
      handleSelect(results[active])
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl
        border border-gray-200 dark:border-gray-700 overflow-hidden z-10">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-700">
          {loading ? (
            <Loader2 size={16} className="text-gray-400 animate-spin shrink-0" />
          ) : (
            <Search size={16} className="text-gray-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); search(e.target.value) }}
            onKeyDown={handleKeyDown}
            placeholder="Search employees, projects, tasks…"
            className="flex-1 text-sm bg-transparent text-gray-900 dark:text-white
              placeholder-gray-400 focus:outline-none"
          />
          <kbd className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {query.trim() === '' ? (
            <div className="py-10 text-center text-sm text-gray-400">
              Type to search across the app…
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="py-10 text-center text-sm text-gray-400">
              No results for "<span className="text-gray-600">{query}</span>"
            </div>
          ) : (
            results.map((item, i) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                  i === active
                    ? 'bg-blue-50 dark:bg-blue-950'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800',
                )}
              >
                <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                  {TYPE_ICON[item.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
                  <p className="text-xs text-gray-400 truncate">{TYPE_LABEL[item.type]} · {item.subtitle}</p>
                </div>
                <ArrowRight size={13} className={cn(
                  'shrink-0 transition-opacity',
                  i === active ? 'opacity-100 text-blue-500' : 'opacity-0',
                )} />
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 dark:border-gray-700
          bg-gray-50 dark:bg-gray-800/50 text-[10px] text-gray-400">
          <span><kbd className="font-mono bg-white dark:bg-gray-700 px-1 rounded border border-gray-200 dark:border-gray-600">↑↓</kbd> Navigate</span>
          <span><kbd className="font-mono bg-white dark:bg-gray-700 px-1 rounded border border-gray-200 dark:border-gray-600">↵</kbd> Open</span>
          <span><kbd className="font-mono bg-white dark:bg-gray-700 px-1 rounded border border-gray-200 dark:border-gray-600">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
