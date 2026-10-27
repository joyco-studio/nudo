import { portKey } from '@nudo-tsl/core'
import type { DataType, Graph, GraphNode, ResolvedTypes } from '@nudo-tsl/core'

import { InlineField, MutedHint } from '@/features/canvas/inline-field'
import type { InputRowModel } from '@/features/canvas/node-port-layout'
import { PortLabel } from '@/features/canvas/port-label'
import { PortTypeLabel } from '@/features/canvas/port-handle'
import { registry } from '@/store/registry'

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

  return (
    <li data-port-id={input.id} className={INSPECTOR_ROW_CLASS}>
      <PortTypeLabel dataType={dataType} />
      {disabledHint !== null ? (
        <>
          <PortLabel label={input.label} isMuted />
          <MutedHint>{disabledHint}</MutedHint>
        </>
      ) : sourceTitle !== null ? (
        <>
          <PortLabel label={input.label} />
          <MutedHint>{`From ${sourceTitle}`}</MutedHint>
        </>
      ) : (
        <InlineField node={node} input={input} dataType={dataType} />
      )}
      <span className="sr-only">, {dataType}</span>
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
