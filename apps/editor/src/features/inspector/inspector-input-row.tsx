import { portKey } from '@nudo-tsl/core'
import type { DataType, Graph, GraphNode, ResolvedTypes } from '@nudo-tsl/core'

import { InlineField, MutedHint } from '@/features/canvas/inline-field'
import type { InputRowModel } from '@/features/canvas/node-port-layout'
import { TypeForAssistiveTech } from '@/features/canvas/node-view'
import { PortLabel } from '@/features/canvas/port-label'
import { PortTypeLabel } from '@/features/canvas/port-handle'
import { useNodeRegistry } from '@/i18n/use-node-registry'
import { useT } from '@/i18n/use-t'

import { connectedSourceTitle } from './inspector-model'

export const INSPECTOR_ROW_CLASS = 'flex min-h-9 flex-wrap items-center gap-x-2 px-3'

interface InspectorInputRowProps {
  node: GraphNode
  row: InputRowModel
  dataType: DataType
  /** The node feeding this input, or null while nothing is connected to it. */
  sourceTitle: string | null
}

/**
 * One input in the Inspector: the same editor the node shows inline (drawn larger by the
 * Inspector's field size), or why there is nothing to edit: it is fed by another node, or the
 * material ignores it.
 */
function InspectorInputRow({ node, row, dataType, sourceTitle }: InspectorInputRowProps) {
  const { input, disabledHint } = row
  const t = useT()

  return (
    <li data-port-id={input.id} className={INSPECTOR_ROW_CLASS}>
      <PortTypeLabel dataType={dataType} />
      {disabledHint !== null ? (
        <>
          <PortLabel label={input.label} isMuted />
          <MutedHint>{t(disabledHint)}</MutedHint>
        </>
      ) : sourceTitle !== null ? (
        <>
          <PortLabel label={input.label} />
          <MutedHint>{t('inspector.from', { node: sourceTitle })}</MutedHint>
        </>
      ) : (
        <InlineField node={node} input={input} dataType={dataType} />
      )}
      <TypeForAssistiveTech dataType={dataType} />
      {input.description !== undefined && (
        <p className="-mt-1 basis-full pb-2 pl-4 text-micro text-pretty text-muted-foreground">
          {input.description}
        </p>
      )}
    </li>
  )
}

interface InspectorInputRowsProps {
  graph: Graph
  node: GraphNode
  rows: readonly InputRowModel[]
  types: ResolvedTypes
}

/** The rows of a node's inputs, each in its resolved type and with the node that feeds it. */
export function InspectorInputRows({ graph, node, rows, types }: InspectorInputRowsProps) {
  const registry = useNodeRegistry()
  return rows.map((row) => {
    const ref = { nodeId: node.id, portId: row.input.id }
    const dataType = types.inputs.get(portKey(ref))
    if (dataType === undefined) return null
    return (
      <InspectorInputRow
        key={row.input.id}
        node={node}
        row={row}
        dataType={dataType}
        sourceTitle={connectedSourceTitle(graph, registry, ref)}
      />
    )
  })
}
