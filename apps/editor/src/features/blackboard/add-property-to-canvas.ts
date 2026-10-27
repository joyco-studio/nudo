import type { NodeId, PropertyId, XY } from '@nudo-tsl/core'

import { focusFlowNode } from '@/features/canvas/focus-flow-node'
import { useEditorStore } from '@/store/editor-store'

/**
 * Adds a reader node of the property at `position` (one history entry), then selects and focuses
 * it, so the keyboard carries on from the new node.
 */
export function addPropertyToCanvas(propertyId: PropertyId, position: XY): NodeId | null {
  const store = useEditorStore.getState()
  const nodeId = store.addPropertyNode(propertyId, position)
  if (nodeId === null) return null
  store.setSelection([nodeId])
  focusFlowNode(nodeId)
  return nodeId
}
