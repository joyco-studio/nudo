import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Graph } from '@nudo-tsl/core'
import { useStoreApi } from '@xyflow/react'
import type { ReactFlowState } from '@xyflow/react'

import { findExample } from '@/examples'
import type { Example } from '@/examples'
import { usePanelAwareView } from '@/features/canvas/use-panel-aware-view'
import { useLocale, useT } from '@/i18n/use-t'
import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'
import { describeGraphContents, graphContents, hasWorkToLose } from '@/shared/lib/graph-contents'
import type { GraphContents } from '@/shared/lib/graph-contents'
import { ReplaceGraphDialog } from '@/shared/components/replace-graph-dialog'
import { useEditorStore } from '@/store/editor-store'

import { ExamplesContext } from './examples-context'
import type { RequestExample } from './examples-context'
import { isGraphMeasured } from './is-graph-measured'
import { openExample } from './open-example'

interface ExamplesProviderProps {
  children: ReactNode
}

interface PendingExample {
  readonly example: Example
  readonly contents: GraphContents
}

/**
 * Owns opening examples: the header menu and the command palette both go through it. A graph
 * with work in it asks first; opening is one undo step and frames the example in the view. Must
 * sit inside a `ReactFlowProvider`.
 */
export function ExamplesProvider({ children }: ExamplesProviderProps) {
  const { fitAll } = usePanelAwareView()
  const { locale } = useLocale()
  const t = useT()
  const [pending, setPending] = useState<PendingExample | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const openerRef = useRef<HTMLElement | null>(null)
  const flowStore = useStoreApi()
  // Stops waiting to frame the last example opened (another one opened, or the editor unmounts).
  const cancelFitRef = useRef<(() => void) | null>(null)

  useEffect(
    () => () => {
      cancelFitRef.current?.()
    },
    [],
  )

  /**
   * Frames `graph` once the canvas holds all of its nodes, measured. Sizes the canvas kept from
   * an earlier graph with the same ids count, so opening the same example again frames it on the
   * next frame instead of waiting for a measurement that never comes.
   */
  const fitWhenMeasured = useCallback(
    (graph: Graph) => {
      cancelFitRef.current?.()
      const fitIfMeasured = (state: ReactFlowState): void => {
        if (!isGraphMeasured(graph, (nodeId) => state.nodeLookup.get(nodeId)?.measured)) return
        cancelFitRef.current?.()
        fitAll()
      }
      const unsubscribe = flowStore.subscribe(fitIfMeasured)
      // The canvas takes the new nodes on its next render: check from then on, not before.
      const frame = requestAnimationFrame(() => {
        fitIfMeasured(flowStore.getState())
      })
      cancelFitRef.current = () => {
        unsubscribe()
        cancelAnimationFrame(frame)
        cancelFitRef.current = null
      }
    },
    [flowStore, fitAll],
  )

  const open = useCallback(
    (example: Example) => {
      if (openExample(example, locale)) fitWhenMeasured(useEditorStore.getState().graph)
    },
    [locale, fitWhenMeasured],
  )

  const requestExample = useCallback<RequestExample>(
    (id, opener) => {
      const example = findExample(id)
      if (example === undefined) return
      const contents = graphContents(useEditorStore.getState().graph)
      openerRef.current = opener
      if (!hasWorkToLose(contents)) {
        open(example)
        focusOpenerOrCanvas(opener)
        return
      }
      setPending({ example, contents })
      setIsOpen(true)
    },
    [open],
  )

  const confirm = useCallback(() => {
    if (pending !== null) open(pending.example)
    setIsOpen(false)
  }, [open, pending])

  const restoreFocus = useCallback(() => {
    focusOpenerOrCanvas(openerRef.current)
  }, [])

  return (
    <ExamplesContext value={requestExample}>
      {children}
      <ReplaceGraphDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title={pending === null ? '' : t('openExample.title', { title: t(pending.example.title) })}
        description={
          pending === null
            ? ''
            : t('openExample.description', {
                contents: describeGraphContents(pending.contents, t),
              })
        }
        confirmLabel={t('openExample.confirm')}
        onConfirm={confirm}
        restoreFocus={restoreFocus}
      />
    </ExamplesContext>
  )
}
