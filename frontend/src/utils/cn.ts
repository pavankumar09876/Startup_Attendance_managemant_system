// Utility to merge Tailwind class names conditionally
type ClassValue = string | undefined | null | false | ClassValue[]

export function cn(...classes: ClassValue[]): string {
  return classes
    .flat(Infinity as 0)
    .filter(Boolean)
    .join(' ')
}
