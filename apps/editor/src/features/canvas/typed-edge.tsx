import { memo } from 'react'
import type { Conversion } from '@nudo-tsl/core'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

import { PORT_COLORS, PORT_LABELS } from '@/shared/theme/port-colors'

import type { FlowEdge } from './to-flow'

const EDGE_WIDTH = 2
const SELECTED_HALO_WIDTH = 6
const FALLBACK_STROKE = 'var(--muted-foreground)'

const CONVERSION_DESCRIPTIONS: Readonly<Record<Conversion['kind'], (c: Conversion) => string>> = {
  splat: (c) => `Conversion: ${c.from} repeated into every ${c.to} component`,
  truncate: (c) => `Conversion: ${c.from} truncated to ${c.to}`,
  pad: (c) => `Conversion: ${c.from} padded to ${c.to}`,
}

function ConversionMarker({ conversion, x, y }: { conversion: Conversion; x: number; y: number }) {
  const description = CONVERSION_DESCRIPTIONS[conversion.kind](conversion)
  return (
    <EdgeLabelRenderer>
      <span
        role="img"
        aria-label={description}
        title={description}
        className="typed-edge-marker nodrag nopan absolute flex h-4 items-center border bg-background px-1 font-mono text-[10px] leading-none text-muted-foreground"
        style={{ transform: `translate(-50%, -50%) translate(${String(x)}px, ${String(y)}px)` }}
      >
        {PORT_LABELS[conversion.from]}→{PORT_LABELS[conversion.to]}
      </span>
    </EdgeLabelRenderer>
  )
}

/** An edge stroked in its source type color, with a midpoint marker when a conversion applies. */
function TypedEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<FlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const stroke = data === undefined ? FALLBACK_STROKE : PORT_COLORS[data.sourceType]

  return (
    <>
      {selected === true && (
        <path
          d={path}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={SELECTED_HALO_WIDTH}
          className="typed-edge-halo"
        />
      )}
      <BaseEdge
        id={id}
        path={path}
        className="typed-edge"
        style={{ stroke, strokeWidth: EDGE_WIDTH }}
      />
      {data?.conversion != null && (
        <ConversionMarker conversion={data.conversion} x={labelX} y={labelY} />
      )}
    </>
  )
}

export const TypedEdge = memo(TypedEdgeComponent)
