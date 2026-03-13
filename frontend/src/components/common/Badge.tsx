import { cn } from '@/utils/cn'

interface BadgeProps {
  label: string
  className?: string
}

// Generic badge — pass className for color (e.g. from status maps)
const Badge = ({ label, className }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
      className,
    )}
  >
    {label.replace(/_/g, ' ')}
  </span>
)

export default Badge
