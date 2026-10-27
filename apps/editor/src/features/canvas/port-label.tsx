import { cn } from '@/shared/lib/utils'

interface PortLabelProps {
  label: string
  /** For a row that has no effect right now. */
  isMuted?: boolean
}

export function PortLabel({ label, isMuted = false }: PortLabelProps) {
  return (
    <span className={cn('min-w-0 flex-1 truncate text-xs', isMuted && 'text-muted-foreground')}>
      {label}
    </span>
  )
}
