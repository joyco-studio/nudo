import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, Circle, LoaderCircle, Play, Square, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { CANVAS_OVERLAY_PROPS } from '@/features/canvas/measure-canvas-insets'
import type { MessageKey } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'
import { cn } from '@/shared/lib/utils'
import { useOverlayMotion } from '@/shared/motion/use-motion-preset'
import { Button } from '@/shared/ui/button'
import { useEditorStore } from '@/store/editor-store'
import type { AgentStep, AgentTask } from '@/store/store-types'

import { useAgentUi } from './agent-ui-context'
import { resumeAgent, stopAgent } from './task-machine'
import { hasSnapshot, undoAll } from './undo-all'
import { useTaskTimer } from './use-task-timer'

const STEP_ICONS: Readonly<Record<AgentStep['state'], LucideIcon>> = {
  done: Check,
  current: LoaderCircle,
  pending: Circle,
}

const STEP_STATE_LABELS: Readonly<Record<AgentStep['state'], MessageKey>> = {
  done: 'agent.step.done',
  current: 'agent.step.current',
  pending: 'agent.step.pending',
}

function StepRow({ step }: { step: AgentStep }) {
  const t = useT()
  const Icon = STEP_ICONS[step.state]
  const isCurrent = step.state === 'current'
  return (
    <li
      aria-current={isCurrent ? 'step' : undefined}
      className={cn(
        'flex min-h-7 items-center gap-2 px-2 text-xs',
        isCurrent ? 'bg-agent-soft font-medium text-agent' : 'text-foreground',
        step.state === 'pending' && 'text-muted-foreground',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'size-3.5 shrink-0',
          step.state === 'done' && 'text-muted-foreground',
          // A constant spin stands for time passing; reduced motion holds it still.
          isCurrent && 'animate-spin motion-reduce:animate-none',
          step.state === 'pending' && 'size-2.5',
        )}
      />
      <span className="sr-only">{`${t(STEP_STATE_LABELS[step.state])}: `}</span>
      <span className="min-w-0 flex-1 truncate">{step.label}</span>
      {step.detail === null ? null : (
        <span className="shrink-0 font-mono text-micro tabular-nums opacity-80">{step.detail}</span>
      )}
    </li>
  )
}

function StatusText({ task }: { task: AgentTask }) {
  const t = useT()
  const elapsed = useTaskTimer(task.startedAt, task.status === 'active')
  switch (task.status) {
    case 'active':
      return t('agent.panel.working', { elapsed })
    case 'stopped':
      return t('agent.panel.stopped')
    case 'finished':
      return t('agent.panel.done')
  }
}

function TaskBody({ task }: { task: AgentTask }) {
  const t = useT()
  const name = task.agent.name
  return (
    <div className="grid gap-2 p-2">
      {task.implicit || task.prompt === null ? null : (
        <p className="px-2 text-xs text-muted-foreground">
          {t('agent.panel.prompt', { prompt: task.prompt })}
        </p>
      )}
      {task.steps.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">{t('agent.panel.noSteps', { name })}</p>
      ) : (
        <ol className="grid gap-px">
          {task.steps.map((step, index) => (
            // Labels can repeat; a step keeps its place in the list.
            <StepRow key={index} step={step} />
          ))}
        </ol>
      )}
      {task.status === 'finished' && task.summary !== null ? (
        <p className="px-2 text-xs">{task.summary}</p>
      ) : null}
      {task.status === 'stopped' ? (
        <div className="flex flex-wrap items-center gap-2 px-2">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            {t('agent.panel.stoppedNote', { name })}
          </p>
          <Button variant="secondary" size="sm" className="h-7" onClick={resumeAgent}>
            <Play aria-hidden="true" />
            {t('agent.panel.resume')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * What the agent is doing: who, for how long, the person's request, each step and its detail, with
 * Stop (or Let it continue) and Undo all. A labeled region floating at the bottom left; Escape
 * collapses it and focus goes back to the toolbar control. Step changes are announced by the
 * presence layer's live region, not here.
 */
export function AgentActivityPanel() {
  const t = useT()
  const ui = useAgentUi()
  const task = useEditorStore((state) => state.agentTask)
  const isOpen = ui.isPanelOpen && task !== null
  const { presence, element, presenceKey } = useOverlayMotion('quickFade', isOpen)
  const sectionRef = useRef<HTMLElement | null>(null)
  // Undo all changes no store state when the task is stopped; re-render to disable the button.
  const [, setUndoCount] = useState(0)

  useEffect(() => {
    if (ui.panelFocusRequest === 0) return
    sectionRef.current?.focus({ preventScroll: true })
  }, [ui.panelFocusRequest])

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    ui.collapsePanel()
  }

  const runUndoAll = (): void => {
    void undoAll(() => ui.confirm('undo_all')).then(() => {
      setUndoCount((count) => count + 1)
    })
  }

  return (
    <AnimatePresence key={presenceKey} {...presence}>
      {ui.isPanelOpen && task !== null ? (
        <motion.section
          key="agent-activity"
          ref={sectionRef}
          {...element}
          {...CANVAS_OVERLAY_PROPS}
          id={ui.panelId}
          aria-label={t('agent.panel.region', { name: task.agent.name })}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="pointer-events-auto w-72 max-w-full border bg-background/85 backdrop-blur-md"
        >
          <div className="flex h-9 items-center gap-2 bg-muted/50 pr-1 pl-3">
            <h2 className="min-w-0 flex-1 truncate text-xs">
              <span className="font-semibold">{task.agent.name}</span>
              <span className="text-muted-foreground">
                {' · '}
                <StatusText task={task} />
              </span>
            </h2>
            {task.status === 'active' ? (
              <Button variant="secondary" size="sm" className="h-7" onClick={stopAgent}>
                <Square aria-hidden="true" className="size-3 fill-current" />
                {t('agent.panel.stop')}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              static
              aria-label={t('agent.panel.collapse')}
              onClick={ui.collapsePanel}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          <TaskBody task={task} />
          <div className="flex items-center justify-end border-t p-1">
            {/* Once the task is over the toolbar control reopens this panel, so the connection
                details are one step away from here instead. */}
            {task.status === 'finished' ? (
              <Button variant="ghost" size="sm" className="mr-auto" onClick={ui.openConnectDialog}>
                {t('agent.panel.connection')}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" disabled={!hasSnapshot()} onClick={runUndoAll}>
              {t('agent.panel.undoAll')}
            </Button>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  )
}
