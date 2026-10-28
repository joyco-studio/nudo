import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useReactFlow } from '@xyflow/react'

import { fitViewOptionsFor } from '@/features/canvas/fit-view-options'
import { useT } from '@/i18n/use-t'
import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'
import { useEditorStore } from '@/store/editor-store'

import { describeGraphContents, graphContents, hasWorkToLose } from './graph-contents'
import type { GraphContents } from './graph-contents'
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
  const [contents, setContents] = useState<GraphContents>({ nodeCount: 0, propertyCount: 0 })
  const t = useT()
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
      const current = graphContents(useEditorStore.getState().graph)
      if (!hasWorkToLose(current)) {
        resetGraph()
        return
      }
      openerRef.current = opener
      setContents(current)
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
        contentsLabel={describeGraphContents(contents, t)}
        onConfirm={confirm}
        restoreFocus={restoreFocus}
      />
    </NewGraphContext>
  )
}
