import { cn } from '@/utils/cn'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const sizeClasses: Record<Size, string> = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
}

interface AvatarProps {
  name: string
  src?: string
  size?: Size
  className?: string
}

const getInitials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

// Deterministic color from name
const colors = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
]
const getColor = (name: string) =>
  colors[name.charCodeAt(0) % colors.length]

const Avatar = ({ name, src, size = 'md', className }: AvatarProps) => (
  <div
    className={cn(
      'rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0',
      sizeClasses[size],
      !src && getColor(name),
      className,
    )}
  >
    {src ? (
      <img src={src} alt={name} className="w-full h-full rounded-full object-cover" />
    ) : (
      getInitials(name)
    )}
  </div>
)

export default Avatar
