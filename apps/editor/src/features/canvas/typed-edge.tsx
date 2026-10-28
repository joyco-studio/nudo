import { memo } from 'react'
import type { Conversion } from '@nudo-tsl/core'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

import { PORT_COLORS, PORT_LABELS } from '@/shared/theme/port-colors'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { EdgeContextMenu } from './edge-context-menu'

import type { FlowEdge } from './to-flow'

const SELECTED_HALO_WIDTH = 6
/** The dark theme's foreground outline: 1px beyond the halo on each side. */
const SELECTED_OUTLINE_WIDTH = 2
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
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={description}
            className="typed-edge-marker nodrag nopan absolute flex h-4 items-center border bg-background px-1 font-mono text-micro leading-none text-muted-foreground"
            style={{ transform: `translate(-50%, -50%) translate(${String(x)}px, ${String(y)}px)` }}
          >
            {PORT_LABELS[conversion.from]}→{PORT_LABELS[conversion.to]}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" aria-hidden="true">
          {description}
        </TooltipContent>
      </Tooltip>
    </EdgeLabelRenderer>
  )
}

/**
 * An edge stroked in its source type color, with a midpoint marker when a conversion applies, and
 * a right-click menu.
 */
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
    <EdgeContextMenu edgeId={id} midpoint={{ x: labelX, y: labelY }}>
      <g>
        {selected === true && (
          <>
            {/* In dark, primary alone is under 3:1 on the canvas: a foreground outline carries it. */}
            <path
              d={path}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={SELECTED_HALO_WIDTH + SELECTED_OUTLINE_WIDTH}
              className="typed-edge-halo hidden dark:inline"
            />
            <path
              d={path}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={SELECTED_HALO_WIDTH}
              className="typed-edge-halo"
            />
          </>
        )}
        <BaseEdge
          id={id}
          path={path}
          className="typed-edge"
          // Its width comes from graph-canvas.css, so focus and the chain highlight can change it.
          style={{ stroke }}
        />
        {data?.conversion != null && (
          <ConversionMarker conversion={data.conversion} x={labelX} y={labelY} />
        )}
      </g>
    </EdgeContextMenu>
  )
}

export const TypedEdge = memo(TypedEdgeComponent)
