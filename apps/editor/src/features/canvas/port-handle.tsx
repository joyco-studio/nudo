import type { DataType } from '@nudo-tsl/core'
import { Handle, Position } from '@xyflow/react'

import { PORT_COLORS, PORT_LABELS } from '@/shared/theme/port-colors'

interface PortHandleProps {
  portId: string
  side: 'input' | 'output'
  dataType: DataType
}

/** The connection dot on the node edge, colored by type. */
export function PortHandle({ portId, side, dataType }: PortHandleProps) {
  return (
    <Handle
      id={portId}
      type={side === 'input' ? 'target' : 'source'}
      position={side === 'input' ? Position.Left : Position.Right}
      className="port-handle"
      style={{ backgroundColor: PORT_COLORS[dataType] }}
    />
  )
}

interface PortTypeLabelProps {
  dataType: DataType
}

/** The type as text (`1`, `2`, `3`, `4`, `T`), so type never relies on color alone. */
export function PortTypeLabel({ dataType }: PortTypeLabelProps) {
  return (
    <span
      aria-hidden="true"
      title={dataType}
      className="w-2 shrink-0 text-center font-mono text-[10px] leading-none text-muted-foreground"
    >
      {PORT_LABELS[dataType]}
    </span>
  )
}
