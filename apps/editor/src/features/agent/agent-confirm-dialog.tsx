import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { MessageKey, Translate } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'
import { ReplaceGraphDialog } from '@/shared/components/replace-graph-dialog'
import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'
import { describeGraphContents, graphContents } from '@/shared/lib/graph-contents'
import { useEditorStore } from '@/store/editor-store'

import type { AgentConfirmKind, ConfirmBroker } from './confirm-broker'

interface ConfirmCopy {
  readonly title: MessageKey
  readonly description: MessageKey
  readonly action: MessageKey
}

const COPY: Readonly<Record<AgentConfirmKind, ConfirmCopy>> = {
  new_graph: {
    title: 'agent.confirm.newGraph.title',
    description: 'agent.confirm.newGraph.description',
    action: 'agent.confirm.newGraph.action',
  },
  load_template: {
    title: 'agent.confirm.loadTemplate.title',
    description: 'agent.confirm.loadTemplate.description',
    action: 'agent.confirm.loadTemplate.action',
  },
  undo_all: {
    title: 'agent.confirm.undoAll.title',
    description: 'agent.confirm.undoAll.description',
    action: 'agent.confirm.undoAll.action',
  },
}

function useAgentName(t: Translate): string {
  const name = useEditorStore((state) => state.agentTask?.agent.name ?? null)
  return name ?? t('agent.fallbackName')
}

/**
 * The one confirm dialog for the agent: replacing the graph (asked by the agent's tools) and Undo
 * all (asked by the panel). Cancel, Escape and clicking outside all answer no. Focus goes back to
 * what had it when the question came.
 */
export function AgentConfirmDialog({ broker }: { broker: ConfirmBroker }) {
  const t = useT()
  const pending = useSyncExternalStore(broker.subscribe, broker.pending)
  const name = useAgentName(t)
  const graph = useEditorStore((state) => state.graph)
  // The copy stays on the last question while the dialog animates out.
  const [shownKind, setShownKind] = useState<AgentConfirmKind>('new_graph')
  if (pending !== null && pending !== shownKind) setShownKind(pending)
  const openerRef = useRef<HTMLElement | null>(null)

  // Read as the question arrives, before the dialog takes focus.
  useEffect(
    () =>
      broker.subscribe(() => {
        if (broker.pending() === null) return
        const focused = document.activeElement
        openerRef.current = focused instanceof HTMLElement ? focused : null
      }),
    [broker],
  )

  const restoreFocus = useCallback(() => {
    focusOpenerOrCanvas(openerRef.current)
  }, [])

  const copy = COPY[shownKind]
  return (
    <ReplaceGraphDialog
      open={pending !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) broker.answer(false)
      }}
      title={t(copy.title, { name })}
      description={t(copy.description, {
        contents: describeGraphContents(graphContents(graph), t),
      })}
      confirmLabel={t(copy.action)}
      onConfirm={() => {
        broker.answer(true)
      }}
      restoreFocus={restoreFocus}
    />
  )
}
