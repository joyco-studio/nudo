import type { Graph, ResolvedTypes } from '@nudo-tsl/core'
import { Trash2 } from 'lucide-react'

import { Button } from '@/shared/ui/button'

import { GraphInspector } from './graph-inspector'
import type { InspectorSubject } from './inspector-model'
import { InspectorHeader } from './inspector-section'
import { NodeInspector } from './node-inspector'
import type { ResizeFrame } from './node-inspector'

export interface InspectorPanelProps {
  subject: InspectorSubject
  graph: Graph
  types: ResolvedTypes
  onResizeFrame: ResizeFrame
  onDeleteSelection: () => void
}

interface SelectionSummaryProps {
  count: number
  onDelete: () => void
}

/** Several nodes have nothing to edit together; they can be deleted together. */
function SelectionSummary({ count, onDelete }: SelectionSummaryProps) {
  return (
    <div className="pb-3">
      <InspectorHeader title={`${String(count)} nodes selected`}>
        <p className="text-xs text-pretty text-muted-foreground">
          Select one node to edit its values.
        </p>
      </InspectorHeader>
      <div className="px-3">
        <Button variant="outline" size="sm" className="rounded-none" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
          Delete selected nodes
        </Button>
      </div>
    </div>
  )
}

/** The Inspector's body: the selected node, a multi-selection summary, or the graph settings. */
export function InspectorPanel({
  subject,
  graph,
  types,
  onResizeFrame,
  onDeleteSelection,
}: InspectorPanelProps) {
  switch (subject.kind) {
    case 'node':
      return (
        <NodeInspector
          // A fresh view per node, so no half-typed draft carries over to the next selection.
          key={subject.node.id}
          graph={graph}
          node={subject.node}
          definition={subject.definition}
          types={types}
          onResizeFrame={onResizeFrame}
        />
      )
    case 'selection':
      return <SelectionSummary count={subject.count} onDelete={onDeleteSelection} />
    case 'graph':
      return <GraphInspector graph={graph} types={types} />
  }
}
