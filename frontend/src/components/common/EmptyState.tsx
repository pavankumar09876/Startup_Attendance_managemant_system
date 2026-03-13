import { type ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

const EmptyState = ({
  title = 'No data found',
  description = 'There are no items to display.',
  icon,
  action,
}: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-gray-300 mb-4">
      {icon ?? <Inbox size={48} />}
    </div>
    <h3 className="text-[15px] font-medium text-gray-700 mb-1">{title}</h3>
    <p className="text-sm text-gray-500 mb-4 max-w-xs">{description}</p>
    {action}
  </div>
)

export default EmptyState
