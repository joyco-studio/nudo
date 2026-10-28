import type { NodeProps } from '@xyflow/react'

import type { FlowNode } from './to-flow'

/**
 * The `memo` comparison every node view uses. The views draw from `data` and `selected` alone, so a
 * node that only moves (new position props, the same data) is not rendered again: React Flow
 * places its wrapper. A view that starts reading another prop must compare it here too.
 */
export function rendersSameNode(previous: NodeProps<FlowNode>, next: NodeProps<FlowNode>): boolean {
  return previous.data === next.data && previous.selected === next.selected
}
