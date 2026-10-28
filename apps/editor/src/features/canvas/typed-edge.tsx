import { memo, useRef } from 'react'
import type { Conversion } from '@nudo-tsl/core'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

import { PORT_COLORS, PORT_LABELS } from '@/shared/theme/port-colors'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { describeConversion } from './describe-conversion'
import { EdgeContextMenu } from './edge-context-menu'
import { useEdgeKeyboardFocus } from './use-edge-keyboard-focus'
import { useForcedTooltipOpen } from './use-forced-tooltip-open'

import type { FlowEdge } from './to-flow'

const EDGE_WIDTH = 2
const SELECTED_HALO_WIDTH = 6
/** The dark theme's foreground outline: 1px beyond the halo on each side. */
const SELECTED_OUTLINE_WIDTH = 2
const FALLBACK_STROKE = 'var(--muted-foreground)'

interface ConversionMarkerProps {
  conversion: Conversion
  x: number
  y: number
  /** The edge has keyboard focus: the explanation shows without a hover. */
  isEdgeFocused: boolean
}

/**
 * The `1→3` badge at the middle of an edge whose value is converted on the way in. Its tooltip says
 * what happens to the value; the edge's accessible name carries the same sentence.
 */
function ConversionMarker({ conversion, x, y, isEdgeFocused }: ConversionMarkerProps) {
  const description = describeConversion(conversion)
  const tooltipOpen = useForcedTooltipOpen(isEdgeFocused ? true : null)
  return (
    <EdgeLabelRenderer>
      <Tooltip {...tooltipOpen}>
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
        <TooltipContent side="top" aria-hidden="true" className="max-w-60 text-pretty">
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
  const groupRef = useRef<SVGGElement>(null)
  const isKeyboardFocused = useEdgeKeyboardFocus(groupRef)

  return (
    <EdgeContextMenu edgeId={id}>
      <g ref={groupRef}>
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
          style={{ stroke, strokeWidth: EDGE_WIDTH }}
        />
        {data?.conversion != null && (
          <ConversionMarker
            conversion={data.conversion}
            x={labelX}
            y={labelY}
            isEdgeFocused={isKeyboardFocused}
          />
        )}
      </g>
    </EdgeContextMenu>
  )
}

export const TypedEdge = memo(TypedEdgeComponent)
