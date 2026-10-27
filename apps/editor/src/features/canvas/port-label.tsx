import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/utils'

interface PortLabelProps extends Omit<ComponentProps<'span'>, 'children'> {
  label: string
  /** For a row that has no effect right now. */
  isMuted?: boolean
}

/** A port's name in its row. Spreads the rest so a tooltip trigger can wrap it. */
export function PortLabel({ label, isMuted = false, className, ...props }: PortLabelProps) {
  return (
    <span
      {...props}
      className={cn(
        'min-w-0 flex-1 truncate text-xs',
        isMuted && 'text-muted-foreground',
        className,
      )}
    >
      {label}
    </span>
  )
}
