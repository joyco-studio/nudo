import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useReactFlow } from '@xyflow/react'

import { fitViewOptionsFor } from '@/features/canvas/fit-view-options'
import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'
import { useEditorStore } from '@/store/editor-store'

import { describeGraphContents, graphContents, hasWorkToLose } from './graph-contents'
import { NewGraphContext } from './new-graph-context'
import type { RequestNewGraph } from './new-graph-context'
import { NewGraphDialog } from './new-graph-dialog'

interface NewGraphProviderProps {
  children: ReactNode
}

/**
 * Owns "New graph": the header button and Ctrl/⌘ + Alt + N both go through it. A graph with work
 * in it asks first; the reset itself is one undo step. Must sit inside a `ReactFlowProvider`.
 */
export function NewGraphProvider({ children }: NewGraphProviderProps) {
  const { fitView } = useReactFlow()
  const [isOpen, setIsOpen] = useState(false)
  const [contentsLabel, setContentsLabel] = useState('')
  const openerRef = useRef<HTMLElement | null>(null)

  const resetGraph = useCallback(() => {
    useEditorStore.getState().resetGraph()
    // The master is the only node left; bring it into view once React Flow has it again.
    requestAnimationFrame(() => {
      void fitView(fitViewOptionsFor(window.innerWidth))
    })
  }, [fitView])

  const requestNewGraph = useCallback<RequestNewGraph>(
    (opener) => {
      const contents = graphContents(useEditorStore.getState().graph)
      if (!hasWorkToLose(contents)) {
        resetGraph()
        return
      }
      openerRef.current = opener
      setContentsLabel(describeGraphContents(contents))
      setIsOpen(true)
    },
    [resetGraph],
  )

  const confirm = useCallback(() => {
    resetGraph()
    setIsOpen(false)
  }, [resetGraph])

  const restoreFocus = useCallback(() => {
    focusOpenerOrCanvas(openerRef.current)
  }, [])

  return (
    <NewGraphContext value={requestNewGraph}>
      {children}
      <NewGraphDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        contentsLabel={contentsLabel}
        onConfirm={confirm}
        restoreFocus={restoreFocus}
      />
    </NewGraphContext>
  )
}
