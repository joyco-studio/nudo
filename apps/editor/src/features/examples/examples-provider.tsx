import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNodesInitialized } from '@xyflow/react'

import { findExample } from '@/examples'
import type { Example } from '@/examples'
import { usePanelAwareView } from '@/features/canvas/use-panel-aware-view'
import {
  describeGraphContents,
  graphContents,
  hasWorkToLose,
} from '@/features/new-graph/graph-contents'
import type { GraphContents } from '@/features/new-graph/graph-contents'
import { useLocale, useT } from '@/i18n/use-t'
import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'
import { ReplaceGraphDialog } from '@/shared/components/replace-graph-dialog'
import { useEditorStore } from '@/store/editor-store'

import { ExamplesContext } from './examples-context'
import type { RequestExample } from './examples-context'
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
  const isFitPendingRef = useRef(false)
  const areNodesMeasured = useNodesInitialized()

  // Frame the example once React Flow has measured every node of it (its new nodes start
  // unmeasured): fitting earlier would only frame the few it had measured.
  useEffect(() => {
    if (!isFitPendingRef.current || !areNodesMeasured) return
    isFitPendingRef.current = false
    fitAll()
  }, [areNodesMeasured, fitAll])

  const open = useCallback(
    (example: Example) => {
      if (openExample(example, locale)) isFitPendingRef.current = true
    },
    [locale],
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
