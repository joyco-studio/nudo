import type { Ref } from 'react'
import type { DataType } from '@nudo-tsl/core'
import { Handle, Position } from '@xyflow/react'

import { PORT_COLORS, PORT_LABELS } from '@/shared/theme/port-colors'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { PORT_BUTTON_ATTRIBUTE } from './canvas-keyboard-model'
import type { PortSide } from './connect-candidates'

const PORT_BUTTON_PROPS = { [PORT_BUTTON_ATTRIBUTE]: '' }

interface PortHandleProps {
  portId: string
  side: PortSide
  dataType: DataType
  /** What assistive technology announces for the port. */
  accessibleName: string
  buttonRef: Ref<HTMLButtonElement>
  /** Enter or Space on the focused port. */
  onActivate: () => void
  /** Delete or Backspace on the focused port. */
  onDisconnect: () => void
}

/**
 * The connection dot on the node edge, colored by type. It is a React Flow handle, so dragging
 * from it still draws an edge, and a real button inside it, so the keyboard can reach it. The
 * `nokey` class keeps React Flow's own key handling off it.
 */
export function PortHandle({
  portId,
  side,
  dataType,
  accessibleName,
  buttonRef,
  onActivate,
  onDisconnect,
}: PortHandleProps) {
  return (
    <Handle
      id={portId}
      type={side === 'input' ? 'target' : 'source'}
      position={side === 'input' ? Position.Left : Position.Right}
      className="port-handle"
      style={{ backgroundColor: PORT_COLORS[dataType] }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={accessibleName}
        {...PORT_BUTTON_PROPS}
        className="port-button nokey"
        onClick={(event) => {
          // Pointer clicks belong to React Flow (click to connect); a keyboard activation has no
          // click count.
          if (event.detail === 0) onActivate()
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Delete' && event.key !== 'Backspace') return
          event.preventDefault()
          onDisconnect()
        }}
      />
    </Handle>
  )
}

interface PortTypeLabelProps {
  dataType: DataType
}

/** The full type name waits, so it never flashes up while the pointer crosses a node. */
const TYPE_HINT_DELAY_MS = 700

/**
 * The type as text (`1`, `2`, `3`, `4`, `T`), so type never relies on color alone. The full name
 * is spoken with the port; sighted pointer users get it in a tooltip.
 */
export function PortTypeLabel({ dataType }: PortTypeLabelProps) {
  return (
    <Tooltip delayDuration={TYPE_HINT_DELAY_MS}>
      <TooltipTrigger asChild>
        <span
          aria-hidden="true"
          className="w-2 shrink-0 text-center font-mono text-micro leading-none text-muted-foreground"
        >
          {PORT_LABELS[dataType]}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" aria-hidden="true" className="pointer-events-none">
        {dataType}
      </TooltipContent>
    </Tooltip>
  )
}
