import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'

import { useT } from '@/i18n/use-t'
import { cn } from '@/shared/lib/utils'
import { PORT_COLORS, PORT_LABELS } from '@/shared/theme/port-colors'

import { ConnectablePort } from './connectable-port'
import { NodeContextMenu } from './node-context-menu'
import { recordNodeRender } from './node-render-stats'
import { rendersSameNode } from './renders-same-node'
import { inputExplanation, nodeAccessibleDescription, outputExplanation } from './node-explanation'
import { nodeDescriptionId } from './to-flow'
import type { FlowNode } from './to-flow'

/** Selection around the round knot: primary, with a foreground ring outside it in dark. */
const SELECTED_KNOT_CLASS =
  'shadow-[0_0_0_2px_var(--primary)] dark:shadow-[0_0_0_2px_var(--primary),0_0_0_3px_var(--foreground)]'

/**
 * A reroute: a short stretch of wire with a knot in the middle, and no header. The wire and the
 * knot's ring take the type color, and the knot shows the type as text (`1`…`4`), like a port.
 */
function RerouteNodeViewComponent({ data, selected }: NodeProps<FlowNode>) {
  recordNodeRender()
  const t = useT()
  const [input] = data.definition.inputs
  const [output] = data.definition.outputs
  const dataType = output === undefined ? undefined : data.outputTypes[output.id]
  if (input === undefined || output === undefined || dataType === undefined) return null
  const color = PORT_COLORS[dataType]

  return (
    <NodeContextMenu data={data}>
      <div className="reroute-node relative flex h-6 w-10 items-center justify-center">
        <p id={nodeDescriptionId(data.node.id)} className="sr-only">
          {nodeAccessibleDescription(data.definition, t)}
        </p>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2"
          style={{ backgroundColor: color }}
        />
        <span
          aria-hidden="true"
          className={cn(
            'relative flex size-4 items-center justify-center rounded-full border-2 bg-card font-mono text-micro leading-none text-muted-foreground',
            selected && SELECTED_KNOT_CLASS,
          )}
          style={{ borderColor: color }}
        >
          {PORT_LABELS[dataType]}
        </span>
        <ConnectablePort
          nodeId={data.node.id}
          portId={input.id}
          side="input"
          dataType={dataType}
          nodeTitle={data.title}
          portLabel={input.label}
          isConnected={data.connectedInputs.has(input.id)}
          explanation={inputExplanation(input, dataType, data.inputSources[input.id])}
        />
        <ConnectablePort
          nodeId={data.node.id}
          portId={output.id}
          side="output"
          dataType={dataType}
          nodeTitle={data.title}
          portLabel={output.label}
          isConnected={data.connectedOutputs.has(output.id)}
          explanation={outputExplanation(output, dataType)}
        />
      </div>
    </NodeContextMenu>
  )
}

export const RerouteNodeView = memo(RerouteNodeViewComponent, rendersSameNode)
