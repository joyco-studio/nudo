import type { ReactElement } from 'react'
import { useConnection } from '@xyflow/react'

import { useT } from '@/i18n/use-t'
import { TypeChip } from '@/shared/components/type-chip'
import { PORT_COLORS } from '@/shared/theme/port-colors'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { describePortSource, portAccessibleDescription } from './node-explanation'
import type { PortExplanation } from './node-explanation'
import { useForcedTooltipOpen } from './use-forced-tooltip-open'

interface PortTooltipProps {
  explanation: PortExplanation
  /** What else the trigger does, shown last ("Drag to change"). */
  hint?: string
  /** The port's handle button or its label: whatever the pointer rests on or focus lands on. */
  children: ReactElement
}

/**
 * What a port means: its label and type, the definition's description and, for a connected
 * input, the node feeding it. Opens after the shared intent delay on hover and at once on keyboard
 * focus; stays shut while an edge is being dragged, so it never covers the port being aimed at.
 */
export function PortTooltip({ explanation, hint, children }: PortTooltipProps) {
  const isConnecting = useConnection((connection) => connection.inProgress)
  const tooltipOpen = useForcedTooltipOpen(isConnecting ? false : null)
  const t = useT()
  const { label, dataType, description, source } = explanation

  return (
    <Tooltip {...tooltipOpen}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        aria-label={portAccessibleDescription(explanation, t) ?? undefined}
        className="pointer-events-none max-w-60 flex-col items-start gap-1 p-2"
      >
        <span className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: PORT_COLORS[dataType] }}
          />
          <span className="font-medium">{label}</span>
          <TypeChip className="border-background/30 text-background/80">{dataType}</TypeChip>
        </span>
        {description !== null && <span className="text-pretty">{description}</span>}
        {source !== null && (
          <span className="font-mono text-micro text-background/70">
            {describePortSource(source, t)}
          </span>
        )}
        {hint !== undefined && <span className="text-background/70">{hint}</span>}
      </TooltipContent>
    </Tooltip>
  )
}
