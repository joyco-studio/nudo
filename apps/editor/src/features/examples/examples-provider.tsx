import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Graph } from '@nudo-tsl/core'
import { useStoreApi } from '@xyflow/react'
import type { ReactFlowState } from '@xyflow/react'

import { EXAMPLE_IDS, findExample } from '@/examples'
import type { Example, ExampleId } from '@/examples'
import { usePanelAwareView } from '@/features/canvas/use-panel-aware-view'
import { useLocale, useT } from '@/i18n/use-t'
import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'
import { describeGraphContents, graphContents, hasWorkToLose } from '@/shared/lib/graph-contents'
import type { GraphContents } from '@/shared/lib/graph-contents'
import {
  claimOverlay,
  isOverlayReplaced,
  releaseOverlay,
  useCloseWhenReplaced,
} from '@/shared/lib/overlay-coordinator'
import { ReplaceGraphDialog } from '@/shared/components/replace-graph-dialog'
import { useEditorStore } from '@/store/editor-store'

import { ExamplesContext } from './examples-context'
import type { OpenTemplatesBrowser } from './examples-context'
import { isGraphMeasured } from './is-graph-measured'
import { openExample } from './open-example'
import { TemplatesBrowser } from './templates-browser'

const [FIRST_EXAMPLE_ID] = EXAMPLE_IDS

interface ExamplesProviderProps {
  children: ReactNode
}

interface PendingExample {
  readonly example: Example
  readonly contents: GraphContents
}

/**
 * Frames `graph` once the canvas holds all of its nodes, measured. Sizes the canvas kept from an
 * earlier graph with the same ids count, so opening the same example again frames it on the next
 * frame instead of waiting for a measurement that never comes.
 */
function useFitWhenMeasured(): (graph: Graph) => void {
  const { fitAll } = usePanelAwareView()
  const flowStore = useStoreApi()
  // Stops waiting to frame the last example opened (another one opened, or the editor unmounts).
  const cancelFitRef = useRef<(() => void) | null>(null)

  useEffect(
    () => () => {
      cancelFitRef.current?.()
    },
    [],
  )

  return useCallback(
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
}

/**
 * Owns the templates browser (the bundled examples): the header button and the command palette
 * open it, and it opens the chosen template in place of the graph. A graph with work in it asks
 * first; opening is one undo step and frames the template in the view. Must sit inside a
 * `ReactFlowProvider`.
 */
export function ExamplesProvider({ children }: ExamplesProviderProps) {
  const { locale } = useLocale()
  const t = useT()
  const fitWhenMeasured = useFitWhenMeasured()
  const overlayId = useId()
  const [isBrowserOpen, setIsBrowserOpenState] = useState(false)
  const [selectedId, setSelectedId] = useState<ExampleId>(FIRST_EXAMPLE_ID)
  const [pending, setPending] = useState<PendingExample | null>(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  /** What opened the browser: focus goes back there once it closes. */
  const openerRef = useRef<HTMLElement | null>(null)
  /** Where focus goes when the confirmation is cancelled: back into the browser. */
  const cancelFocusRef = useRef<HTMLElement | null>(null)
  const isConfirmedRef = useRef(false)

  const setIsBrowserOpen = useCallback(
    (open: boolean) => {
      setIsBrowserOpenState(open)
      if (open) claimOverlay(overlayId)
      else releaseOverlay(overlayId)
    },
    [overlayId],
  )

  useCloseWhenReplaced(overlayId, isBrowserOpen, () => {
    setIsBrowserOpenState(false)
  })

  const openBrowser = useCallback<OpenTemplatesBrowser>(
    (opener, selected) => {
      openerRef.current = opener
      if (selected !== null) setSelectedId(selected)
      setIsBrowserOpen(true)
    },
    [setIsBrowserOpen],
  )

  const open = useCallback(
    (example: Example) => {
      if (openExample(example, locale)) fitWhenMeasured(useEditorStore.getState().graph)
      setIsBrowserOpen(false)
    },
    [locale, fitWhenMeasured, setIsBrowserOpen],
  )

  const openSelected = useCallback(
    (returnFocusTo: HTMLElement | null) => {
      const example = findExample(selectedId)
      if (example === undefined) return
      const contents = graphContents(useEditorStore.getState().graph)
      if (!hasWorkToLose(contents)) {
        open(example)
        return
      }
      cancelFocusRef.current = returnFocusTo
      isConfirmedRef.current = false
      setPending({ example, contents })
      setIsConfirmOpen(true)
    },
    [open, selectedId],
  )

  const confirm = useCallback(() => {
    isConfirmedRef.current = true
    if (pending !== null) open(pending.example)
    setIsConfirmOpen(false)
  }, [open, pending])

  /** Confirmed: the browser closed with it, so back to the browser's opener; else into the browser. */
  const restoreConfirmFocus = useCallback(() => {
    if (isConfirmedRef.current) {
      focusOpenerOrCanvas(openerRef.current)
      return
    }
    cancelFocusRef.current?.focus({ preventScroll: true })
  }, [])

  const onBrowserCloseAutoFocus = useCallback(
    (event: Event) => {
      event.preventDefault()
      // Another overlay took over: it owns focus now.
      if (isOverlayReplaced(overlayId)) return
      focusOpenerOrCanvas(openerRef.current)
    },
    [overlayId],
  )

  return (
    <ExamplesContext value={openBrowser}>
      {children}
      <TemplatesBrowser
        open={isBrowserOpen}
        onOpenChange={setIsBrowserOpen}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onOpenTemplate={openSelected}
        onCloseAutoFocus={onBrowserCloseAutoFocus}
      />
      <ReplaceGraphDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
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
        restoreFocus={restoreConfirmFocus}
      />
    </ExamplesContext>
  )
}
