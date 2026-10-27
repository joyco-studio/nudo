import type { Graph, NodeId } from '@nudo-tsl/core'

import { nodeTitle } from '@/features/canvas/to-flow'
import { useEditorStore } from '@/store/editor-store'
import { registry } from '@/store/registry'

interface InspectedNode {
  readonly title: string
  readonly description: string
}

function inspectedNode(graph: Graph, selectedNodeIds: readonly NodeId[]): InspectedNode | null {
  const [onlyId] = selectedNodeIds
  if (selectedNodeIds.length !== 1 || onlyId === undefined) return null
  const node = graph.nodes[onlyId]
  const definition = node === undefined ? undefined : registry.get(node.type)
  if (node === undefined || definition === undefined) return null
  return {
    title: nodeTitle(node, definition, graph.properties),
    description: definition.description,
  }
}

/** The Inspector's body for now: the selected node's name and what it does. */
export function InspectorPanel() {
  const graph = useEditorStore((state) => state.graph)
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds)
  const node = inspectedNode(graph, selectedNodeIds)

  if (node !== null) {
    return (
      <div className="flex flex-col gap-1 p-3 text-xs">
        <h3 className="font-heading text-xs font-semibold tracking-wide uppercase">{node.title}</h3>
        <p className="text-muted-foreground">{node.description}</p>
      </div>
    )
  }
  const count = selectedNodeIds.length
  const message = count > 1 ? `${String(count)} nodes selected` : 'Nothing selected'
  return <p className="p-3 text-xs text-muted-foreground">{message}</p>
}
