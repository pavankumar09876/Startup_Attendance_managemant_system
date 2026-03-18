import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'

interface PaginationProps {
  page: number
  totalPages: number
  onNext: () => void
  onPrev: () => void
  onPage: (n: number) => void
}

const Pagination = ({ page, totalPages, onNext, onPrev, onPage }: PaginationProps) => {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)

  return (
    <div className="flex items-center justify-end gap-1 mt-4">
      <button
        onClick={onPrev}
        disabled={page === 1}
        className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={16} />
      </button>

      {pages.map((p, idx) => (
        <>
          {idx > 0 && pages[idx - 1] !== p - 1 && (
            <span key={`ellipsis-${p}`} className="px-1 text-gray-400 dark:text-gray-500">…</span>
          )}
          <button
            key={p}
            onClick={() => onPage(p)}
            className={cn(
              'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
              p === page
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
            )}
          >
            {p}
          </button>
        </>
      ))}

      <button
        onClick={onNext}
        disabled={page === totalPages}
        className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

export default Pagination
