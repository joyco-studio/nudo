import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/utils'

import type { PortExplanation } from './node-explanation'
import { PortTooltip } from './port-tooltip'

interface PortLabelProps extends Omit<ComponentProps<'span'>, 'children'> {
  label: string
  /** For a row that has no effect right now. */
  isMuted?: boolean
  /** What the port means: hovering the label shows it. Left out where the text is shown anyway. */
  explanation?: PortExplanation | undefined
}

/** A port's name in its row. Spreads the rest so a tooltip trigger can wrap it. */
export function PortLabel({
  label,
  isMuted = false,
  explanation,
  className,
  ...props
}: PortLabelProps) {
  const labelElement = (
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
  if (explanation === undefined) return labelElement
  return <PortTooltip explanation={explanation}>{labelElement}</PortTooltip>
}
