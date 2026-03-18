import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { cn } from '@/utils/cn'

/* ── helpers ──────────────────────────────────────────────────────────────── */
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const parse = (s: string): Date | null => {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const isToday = (d: Date) => isSameDay(d, new Date())

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()

const startOfWeek = (year: number, month: number) => new Date(year, month, 1).getDay()

/* ── props ────────────────────────────────────────────────────────────────── */
interface DatePickerProps {
  value?: string               // "YYYY-MM-DD"
  onChange?: (value: string) => void
  min?: string                 // "YYYY-MM-DD"
  max?: string                 // "YYYY-MM-DD"
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  error?: boolean
  className?: string
  id?: string
  name?: string
}

type View = 'days' | 'months' | 'years'

const DatePicker = ({
  value = '',
  onChange,
  min,
  max,
  placeholder = 'Select date',
  disabled = false,
  readOnly = false,
  error = false,
  className,
  id,
  name,
}: DatePickerProps) => {
  const selected = parse(value)
  const today = new Date()

  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('days')
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth())
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear())
  const [yearRangeStart, setYearRangeStart] = useState(viewYear - 4)
  const [dropUp, setDropUp] = useState(false)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // When value changes externally, sync the view
  useEffect(() => {
    const d = parse(value)
    if (d) {
      setViewMonth(d.getMonth())
      setViewYear(d.getFullYear())
    }
  }, [value])

  // Click-outside to close
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setView('days')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Escape key to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setView('days')
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Calculate drop direction
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setDropUp(spaceBelow < 340)
  }, [open])

  const minDate = parse(min ?? '')
  const maxDate = parse(max ?? '')

  const isDisabledDate = useCallback(
    (d: Date) => {
      if (minDate && d < minDate) return true
      if (maxDate && d > maxDate) return true
      return false
    },
    [min, max],
  )

  const handleSelect = (day: number) => {
    const d = new Date(viewYear, viewMonth, day)
    if (isDisabledDate(d)) return
    onChange?.(fmt(d))
    setOpen(false)
    setView('days')
  }

  const handleMonthSelect = (monthIdx: number) => {
    setViewMonth(monthIdx)
    setView('days')
  }

  const handleYearSelect = (year: number) => {
    setViewYear(year)
    setView('months')
  }

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const goToday = () => {
    const d = new Date()
    setViewMonth(d.getMonth())
    setViewYear(d.getFullYear())
    setView('days')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange?.('')
    setOpen(false)
  }

  const toggleOpen = () => {
    if (disabled || readOnly) return
    setOpen((v) => {
      if (!v) {
        // Reset view when opening
        setView('days')
        const d = parse(value)
        if (d) {
          setViewMonth(d.getMonth())
          setViewYear(d.getFullYear())
          setYearRangeStart(d.getFullYear() - 4)
        } else {
          setViewMonth(today.getMonth())
          setViewYear(today.getFullYear())
          setYearRangeStart(today.getFullYear() - 4)
        }
      }
      return !v
    })
  }

  /* ── Build calendar grid ──────────────────────────────────────────────── */
  const totalDays = daysInMonth(viewYear, viewMonth)
  const firstDay = startOfWeek(viewYear, viewMonth)
  const prevMonthDays = viewMonth === 0 ? daysInMonth(viewYear - 1, 11) : daysInMonth(viewYear, viewMonth - 1)

  const cells: { day: number; current: boolean }[] = []
  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, current: false })
  }
  // Current month
  for (let i = 1; i <= totalDays; i++) {
    cells.push({ day: i, current: true })
  }
  // Next month leading days
  const remaining = 42 - cells.length
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, current: false })
  }

  const displayValue = selected
    ? `${selected.getDate()} ${MONTHS_SHORT[selected.getMonth()]} ${selected.getFullYear()}`
    : ''

  return (
    <div ref={wrapperRef} className="relative">
      {/* Hidden native input for form compatibility */}
      {name && <input type="hidden" name={name} value={value} />}

      {/* ── Trigger button ───────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={toggleOpen}
        disabled={disabled}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-all',
          'bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500',
          error
            ? 'border-red-400 dark:border-red-500'
            : open
              ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20'
              : 'border-gray-300 dark:border-gray-600',
          disabled
            ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800'
            : readOnly
              ? 'cursor-default'
              : 'cursor-pointer hover:border-gray-400 dark:hover:border-gray-500',
          className,
        )}
      >
        <Calendar size={15} className="text-gray-400 dark:text-gray-500 shrink-0" />
        <span
          className={cn(
            'flex-1 truncate',
            displayValue ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500',
          )}
        >
          {displayValue || placeholder}
        </span>
        {value && !disabled && !readOnly && (
          <span
            onClick={handleClear}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xs font-bold px-0.5"
          >
            &times;
          </span>
        )}
      </button>

      {/* ── Dropdown calendar ────────────────────────────────────────── */}
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1.5 w-[290px] bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700',
            'shadow-xl dark:shadow-2xl dark:shadow-black/30 overflow-hidden animate-in fade-in-0 zoom-in-95',
            dropUp ? 'bottom-full mb-1.5' : 'top-full',
            // Center-align if trigger is small
            'left-0',
          )}
        >
          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => {
                if (view === 'days') prevMonth()
                else if (view === 'years') setYearRangeStart((s) => s - 12)
              }}
              className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              onClick={() => {
                if (view === 'days') setView('months')
                else if (view === 'months') {
                  setYearRangeStart(viewYear - 4)
                  setView('years')
                }
                else setView('days')
              }}
              className="px-2 py-1 rounded-md text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {view === 'days' && `${MONTHS[viewMonth]} ${viewYear}`}
              {view === 'months' && `${viewYear}`}
              {view === 'years' && `${yearRangeStart} – ${yearRangeStart + 11}`}
            </button>

            <button
              type="button"
              onClick={() => {
                if (view === 'days') nextMonth()
                else if (view === 'years') setYearRangeStart((s) => s + 12)
              }}
              className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* ── Days view ──────────────────────────────────────────── */}
          {view === 'days' && (
            <div className="p-2.5">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map((d) => (
                  <div key={d} className="text-center text-[11px] font-medium text-gray-400 dark:text-gray-500 py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((cell, idx) => {
                  const cellDate = cell.current
                    ? new Date(viewYear, viewMonth, cell.day)
                    : idx < firstDay
                      ? new Date(viewYear, viewMonth - 1, cell.day)
                      : new Date(viewYear, viewMonth + 1, cell.day)

                  const isSelected = selected && isSameDay(cellDate, selected)
                  const isTodayCell = isToday(cellDate)
                  const isOtherMonth = !cell.current
                  const isOff = isDisabledDate(cellDate)

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isOff || isOtherMonth}
                      onClick={() => {
                        if (cell.current && !isOff) handleSelect(cell.day)
                      }}
                      className={cn(
                        'h-8 w-full rounded-lg text-[13px] font-medium transition-all relative',
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                          : isTodayCell && !isOtherMonth
                            ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold'
                            : isOtherMonth
                              ? 'text-gray-300 dark:text-gray-700 cursor-default'
                              : isOff
                                ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
                      )}
                    >
                      {cell.day}
                      {isTodayCell && !isOtherMonth && !isSelected && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Months view ────────────────────────────────────────── */}
          {view === 'months' && (
            <div className="p-3 grid grid-cols-3 gap-2">
              {MONTHS_SHORT.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleMonthSelect(i)}
                  className={cn(
                    'py-2.5 rounded-lg text-sm font-medium transition-all',
                    viewMonth === i
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {/* ── Years view ─────────────────────────────────────────── */}
          {view === 'years' && (
            <div className="p-3 grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => handleYearSelect(y)}
                  className={cn(
                    'py-2.5 rounded-lg text-sm font-medium transition-all',
                    viewYear === y
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {/* ── Footer ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-800">
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!isDisabledDate(today)) {
                  onChange?.(fmt(today))
                  setOpen(false)
                  setView('days')
                } else {
                  goToday()
                }
              }}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors ml-auto"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
