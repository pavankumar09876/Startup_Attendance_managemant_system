import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Home,
  Clock,
  Calendar,
  Folder,
  ClipboardList,
  Users,
  DollarSign,
  BarChart2,
  Settings,
  Plus,
  LogIn,
} from 'lucide-react'
import api from '@/services/api'

interface CommandItem {
  id: string
  label: string
  section: 'Navigation' | 'Quick Actions' | 'Search Results'
  icon: React.ReactNode
  shortcut?: string
  action: () => void
}

interface SearchResult {
  type: string
  id: string
  name: string
  subtitle?: string
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
    setSearchResults([])
  }, [])

  const go = useCallback((path: string) => {
    navigate(path)
    close()
  }, [navigate, close])

  const navItems: CommandItem[] = [
    { id: 'nav-dashboard',  label: 'Go to Dashboard',  section: 'Navigation', icon: <Home size={20} />,          shortcut: 'G D', action: () => go('/dashboard') },
    { id: 'nav-attendance', label: 'Go to Attendance',  section: 'Navigation', icon: <Clock size={20} />,         shortcut: 'G A', action: () => go('/attendance') },
    { id: 'nav-leave',      label: 'Go to Leave',       section: 'Navigation', icon: <Calendar size={20} />,      shortcut: 'G L', action: () => go('/leave') },
    { id: 'nav-projects',   label: 'Go to Projects',    section: 'Navigation', icon: <Folder size={20} />,        shortcut: 'G P', action: () => go('/projects') },
    { id: 'nav-tasks',      label: 'Go to Tasks',       section: 'Navigation', icon: <ClipboardList size={20} />, action: () => go('/tasks') },
    { id: 'nav-staff',      label: 'Go to Staff',       section: 'Navigation', icon: <Users size={20} />,         shortcut: 'G S', action: () => go('/staff') },
    { id: 'nav-payroll',    label: 'Go to Payroll',     section: 'Navigation', icon: <DollarSign size={20} />,    action: () => go('/payroll') },
    { id: 'nav-reports',    label: 'Go to Reports',     section: 'Navigation', icon: <BarChart2 size={20} />,     action: () => go('/reports') },
    { id: 'nav-settings',   label: 'Go to Settings',    section: 'Navigation', icon: <Settings size={20} />,      action: () => go('/settings') },
  ]

  const actionItems: CommandItem[] = [
    { id: 'act-checkin',  label: 'Check In',        section: 'Quick Actions', icon: <LogIn size={20} />, action: () => go('/attendance') },
    { id: 'act-leave',    label: 'Apply Leave',     section: 'Quick Actions', icon: <Plus size={20} />,  action: () => go('/leave') },
    { id: 'act-task',     label: 'Create Task',     section: 'Quick Actions', icon: <Plus size={20} />,  action: () => go('/tasks') },
    { id: 'act-expense',  label: 'Submit Expense',  section: 'Quick Actions', icon: <Plus size={20} />,  action: () => go('/payroll') },
  ]

  // Search results as CommandItems
  const resultItems: CommandItem[] = searchResults.map((r) => ({
    id: `sr-${r.type}-${r.id}`,
    label: r.name,
    section: 'Search Results' as const,
    icon: r.type === 'employee' ? <Users size={20} /> :
          r.type === 'project'  ? <Folder size={20} /> :
          <ClipboardList size={20} />,
    action: () => {
      if (r.type === 'employee') go(`/staff/${r.id}`)
      else if (r.type === 'project') go(`/projects/${r.id}`)
      else go('/tasks')
      close()
    },
  }))

  const allItems = [...(query ? resultItems : []), ...navItems, ...actionItems]
    .filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await api.get('/search', { params: { q: query } })
        const results: SearchResult[] = []
        if (data.employees) data.employees.forEach((e: any) => results.push({ type: 'employee', id: e.id, name: `${e.first_name} ${e.last_name}`, subtitle: e.designation }))
        if (data.projects) data.projects.forEach((p: any) => results.push({ type: 'project', id: p.id, name: p.name }))
        if (data.tasks) data.tasks.forEach((t: any) => results.push({ type: 'task', id: t.id, name: t.title }))
        setSearchResults(results)
      } catch {
        setSearchResults([])
      }
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, allItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && allItems[activeIndex]) {
      e.preventDefault()
      allItems[activeIndex].action()
    }
  }

  if (!open) return null

  // Group items by section
  const sections = allItems.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = []
    acc[item.section].push(item)
    return acc
  }, {})

  let globalIndex = -1

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={close}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
          <Search size={20} className="text-gray-400 dark:text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="w-full px-3 py-3 text-sm bg-transparent text-gray-900 dark:text-white outline-none placeholder-gray-400 dark:placeholder-gray-500"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {searching && (
            <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">Searching...</div>
          )}
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              <div className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {section}
              </div>
              {items.map((item) => {
                globalIndex++
                const idx = globalIndex
                return (
                  <button
                    key={item.id}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors ${
                      idx === activeIndex ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={item.action}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <span className={idx === activeIndex ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
          {allItems.length === 0 && !searching && (
            <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              No results found
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-[11px] text-gray-400 dark:text-gray-500">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
