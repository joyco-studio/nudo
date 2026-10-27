import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { resolvePortTypes } from '@nudo-tsl/core'
import type { NodeId } from '@nudo-tsl/core'

import { FieldSizeContext } from '@/features/canvas/field-size'
import { focusFlowNode } from '@/features/canvas/focus-flow-node'
import { NodeFieldActionsContext } from '@/features/canvas/node-field-actions'
import { storeFieldActions } from '@/features/canvas/store-field-actions'
import { useRunCommand } from '@/features/command-palette/command-context'
import { UNTARGETED } from '@/features/command-palette/command-registry'
import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'
import { isInsideOverlay } from '@/shared/lib/is-inside-overlay'
import { useEditorStore } from '@/store/editor-store'
import { registry } from '@/store/registry'
import type { NodeFrame } from '@/store/store-types'

import { inspectorSubject } from './inspector-model'
import { InspectorPanel } from './inspector-panel'

const getStore = () => useEditorStore.getState()

/** Escape leaves the Inspector for the canvas: the inspected node, or the canvas itself. */
function returnFocusToCanvas(): void {
  const [onlyId, ...others] = getStore().selectedNodeIds
  if (onlyId !== undefined && others.length === 0) {
    focusFlowNode(onlyId)
    return
  }
  focusOpenerOrCanvas(null)
}

/**
 * Escape inside the Inspector returns to the canvas. It listens on the window, after React has
 * handled the key: a field's own Escape has reverted its draft by then, so the blur that leaving
 * causes never commits what was typed. Not gated on defaultPrevented: a tooltip that Escape
 * dismisses on the way marks the key handled, and leaving must still take one press, as it does
 * for fields on the canvas. Open lists and pickers keep Escape for themselves.
 */
function useLeaveWithEscape(rootRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || isInsideOverlay(event.target)) return
      const root = rootRef.current
      if (root === null || !(event.target instanceof Node) || !root.contains(event.target)) return
      returnFocusToCanvas()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [rootRef])
}

function resizeFrame(nodeId: NodeId, frame: NodeFrame): void {
  getStore().commitResize(nodeId, frame)
}

/**
 * Connects the Inspector to the store. Its fields are the canvas node fields drawn at the
 * comfortable size and editing the same store state, so both always agree and each commit is one
 * undo step. Escape returns focus to the canvas.
 */
export function InspectorContainer() {
  const graph = useEditorStore((state) => state.graph)
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds)
  const runCommand = useRunCommand()
  const types = useMemo(() => resolvePortTypes(graph, registry), [graph])
  const subject = inspectorSubject(graph, registry, selectedNodeIds)

  const rootRef = useRef<HTMLDivElement>(null)
  useLeaveWithEscape(rootRef)

  return (
    <div ref={rootRef}>
      <NodeFieldActionsContext value={storeFieldActions}>
        <FieldSizeContext value="comfortable">
          <InspectorPanel
            subject={subject}
            graph={graph}
            types={types}
            onResizeFrame={resizeFrame}
            onDeleteSelection={() => {
              runCommand('delete', UNTARGETED)
            }}
          />
        </FieldSizeContext>
      </NodeFieldActionsContext>
    </div>
  )
}
