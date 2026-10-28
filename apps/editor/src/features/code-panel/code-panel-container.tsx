import { useCallback } from 'react'
import type { NodeId } from '@nudo-tsl/core'

import { focusFlowNode } from '@/features/canvas/focus-flow-node'
import { usePanelAwareView } from '@/features/canvas/use-panel-aware-view'
import { useNodeRegistry } from '@/i18n/use-node-registry'
import { useEditorStore } from '@/store/editor-store'

import { CodePanel } from './code-panel'
import { failedNodesOf } from './failed-nodes'
import { useGeneratedCode } from './use-generated-code'

/** Selects a node, frames it in the canvas the panels leave uncovered and puts focus on it. */
function useShowNode(): (nodeId: NodeId) => void {
  const { frameNodes } = usePanelAwareView()
  return useCallback(
    (nodeId) => {
      useEditorStore.getState().setSelection([nodeId])
      frameNodes([nodeId])
      focusFlowNode(nodeId)
    },
    [frameNodes],
  )
}

/**
 * Connects the code drawer to the live module. The graph is only read while errors need node
 * titles, so moving nodes around never re-renders the code, and a collapsed drawer renders nothing
 * (Copy in the header keeps the module live). Must sit inside a `ReactFlowProvider`.
 */
export function CodePanelContainer() {
  const isOpen = useEditorStore((state) => state.panels.open.code)
  return isOpen ? <OpenCodePanel /> : null
}

function OpenCodePanel() {
  const { code, errors } = useGeneratedCode()
  const graph = useEditorStore((state) => (errors.length > 0 ? state.graph : null))
  const nodeRegistry = useNodeRegistry()
  const showNode = useShowNode()
  const failedNodes = graph === null ? [] : failedNodesOf(errors, graph, nodeRegistry)
  return <CodePanel code={code} failedNodes={failedNodes} onShowNode={showNode} />
}
