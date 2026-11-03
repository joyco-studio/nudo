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
  /** The title when no agent name is known: a sentence of its own, so it reads in every language. */
  readonly titleUnnamed: MessageKey
  readonly description: MessageKey
  readonly action: MessageKey
}

const COPY: Readonly<Record<AgentConfirmKind, ConfirmCopy>> = {
  new_graph: {
    title: 'agent.confirm.newGraph.title',
    titleUnnamed: 'agent.confirm.newGraph.titleUnnamed',
    description: 'agent.confirm.newGraph.description',
    action: 'agent.confirm.newGraph.action',
  },
  load_template: {
    title: 'agent.confirm.loadTemplate.title',
    titleUnnamed: 'agent.confirm.loadTemplate.titleUnnamed',
    description: 'agent.confirm.loadTemplate.description',
    action: 'agent.confirm.loadTemplate.action',
  },
  undo_all: {
    title: 'agent.confirm.undoAll.title',
    titleUnnamed: 'agent.confirm.undoAll.titleUnnamed',
    description: 'agent.confirm.undoAll.description',
    action: 'agent.confirm.undoAll.action',
  },
}

function titleOf(copy: ConfirmCopy, name: string | null, t: Translate): string {
  return name === null ? t(copy.titleUnnamed) : t(copy.title, { name })
}

/** Where focus goes when the dialog closes, given what had it when the question came. */
export type FocusTargetFor = (opener: HTMLElement | null) => HTMLElement | null

const theOpener: FocusTargetFor = (opener) => opener

interface AgentConfirmDialogProps {
  broker: ConfirmBroker
  /** Redirects focus when the opener can't take it back (the provider knows the panel). */
  focusTargetFor?: FocusTargetFor
}

/**
 * The one confirm dialog for the agent: replacing the graph (asked by the agent's tools) and Undo
 * all (asked by the panel). Cancel, Escape and clicking outside all answer no. Focus goes back to
 * what had it when the question came.
 */
export function AgentConfirmDialog({
  broker,
  focusTargetFor = theOpener,
}: AgentConfirmDialogProps) {
  const t = useT()
  const pending = useSyncExternalStore(broker.subscribe, broker.pending)
  const name = useEditorStore((state) => state.agentTask?.agent.name ?? null)
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
    focusOpenerOrCanvas(focusTargetFor(openerRef.current))
  }, [focusTargetFor])

  const copy = COPY[shownKind]
  return (
    <ReplaceGraphDialog
      open={pending !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) broker.answer(false)
      }}
      title={titleOf(copy, name, t)}
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
