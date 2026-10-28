import { cn } from '@/shared/lib/utils'

interface TypeChipProps {
  /** The type as short text (`float`, `vec3`, `color`). */
  children: string
  className?: string
}

/** A type in a small outlined chip: on property nodes, in the Properties panel, in port tooltips. */
export function TypeChip({ children, className }: TypeChipProps) {
  return (
    <span
      data-type-chip
      className={cn(
        'shrink-0 border px-1 font-mono text-micro leading-4 text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}
