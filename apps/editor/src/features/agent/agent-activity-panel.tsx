import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import { Check, Circle, LoaderCircle, Play, Square, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { CANVAS_OVERLAY_PROPS } from '@/features/canvas/measure-canvas-insets'
import type { MessageKey } from '@/i18n/translate'
import { RichMessage } from '@/i18n/rich-message'
import { useT } from '@/i18n/use-t'
import { cn } from '@/shared/lib/utils'
import { useScrollOverflow } from '@/shared/lib/use-scroll-overflow'
import { useOverlayMotion } from '@/shared/motion/use-motion-preset'
import { Button } from '@/shared/ui/button'
import { useEditorStore } from '@/store/editor-store'
import type { AgentStep, AgentTask } from '@/store/store-types'

import { AgentBrandIcon } from './agent-brand-icon'
import { useAgentUi } from './agent-ui-context'
import { showsConnectionEntry } from './agent-ui-model'
import { resumeAgent, stopAgent } from './task-machine'
import { hasSnapshot, subscribeSnapshot, undoAll } from './undo-all'
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
        'flex min-h-7 items-center gap-2 px-2 py-1 text-xs',
        isCurrent ? 'bg-agent-soft font-medium text-agent' : 'text-foreground',
        step.state === 'pending' && 'text-muted-foreground',
      )}
    >
      {/* One slot size for every state, so the labels line up whatever the icon's size. */}
      <span aria-hidden="true" className="flex size-3.5 shrink-0 items-center justify-center">
        <Icon
          className={cn(
            'size-3.5',
            step.state === 'done' && 'text-muted-foreground',
            // A constant spin stands for time passing; reduced motion holds it still.
            isCurrent && 'animate-spin motion-reduce:animate-none',
            step.state === 'pending' && 'size-2.5',
          )}
        />
      </span>
      <span className="sr-only">{`${t(STEP_STATE_LABELS[step.state])}: `}</span>
      {/* The chip truncates the step; here it wraps, so the whole label can be read. */}
      <span className="min-w-0 flex-1 break-words">{step.label}</span>
      {step.detail === null ? null : (
        // Dimmed only off the agent color, which would drop below 4.5:1 on its soft fill.
        <span
          className={cn(
            'shrink-0 font-mono text-micro tabular-nums',
            !isCurrent && 'text-muted-foreground',
          )}
        >
          {step.detail}
        </span>
      )}
    </li>
  )
}

/**
 * "{name} · working 0:14", "{name} · stopped", "{name} · done": one message, so word order
 * translates. The name leads in the foreground; the status around it is muted.
 */
function HeadingText({ task }: { task: AgentTask }) {
  const elapsed = useTaskTimer(task.startedAt, task.status === 'active')
  const name = <span className="font-semibold text-foreground">{task.agent.name}</span>
  switch (task.status) {
    case 'active':
      return (
        <RichMessage
          messageKey="agent.panel.working"
          values={{ name, elapsed: <span className="font-mono tabular-nums">{elapsed}</span> }}
        />
      )
    case 'stopped':
      return <RichMessage messageKey="agent.panel.stopped" values={{ name }} />
    case 'finished':
      return <RichMessage messageKey="agent.panel.done" values={{ name }} />
  }
}

/** The scroll position that shows `row` inside `box`, moving as little as possible. */
function scrollTopToReveal(box: HTMLElement, row: HTMLElement): number {
  const rowTop = row.offsetTop - box.offsetTop
  const rowBottom = rowTop + row.offsetHeight
  if (rowTop < box.scrollTop) return rowTop
  if (rowBottom > box.scrollTop + box.clientHeight) return rowBottom - box.clientHeight
  return box.scrollTop
}

interface TaskBodyProps {
  task: AgentTask
  resumeButtonRef: RefObject<HTMLButtonElement | null>
  onResume: () => void
}

function TaskBody({ task, resumeButtonRef, onResume }: TaskBodyProps) {
  const t = useT()
  const name = task.agent.name
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const { isScrollable } = useScrollOverflow(bodyRef, task.steps.length)
  const currentIndex = task.steps.findIndex((step) => step.state === 'current')

  // A long task keeps its current step in sight as the agent moves on.
  useEffect(() => {
    const body = bodyRef.current
    if (body === null) return
    const current = body.querySelector<HTMLElement>('[aria-current="step"]')
    if (current === null) return
    body.scrollTop = scrollTopToReveal(body, current)
  }, [currentIndex])
  return (
    // One column that may shrink below its content, so long labels wrap inside the panel. A long
    // task scrolls here, between the header (Stop) and the footer (Undo all), which stay put;
    // focusable only then, so a keyboard user can scroll it.
    <div
      ref={bodyRef}
      role="group"
      aria-label={t('agent.panel.steps')}
      tabIndex={isScrollable ? 0 : undefined}
      data-focus-ring="inset"
      className="grid min-h-0 grid-cols-1 content-start gap-2 overflow-y-auto p-2"
    >
      {task.implicit || task.prompt === null ? null : (
        <p className="px-2 text-xs break-words text-muted-foreground">
          {t('agent.panel.prompt', { prompt: task.prompt })}
        </p>
      )}
      {task.steps.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">{t('agent.panel.noSteps', { name })}</p>
      ) : (
        <ol className="grid grid-cols-1 gap-px">
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
          <Button
            ref={resumeButtonRef}
            variant="secondary"
            size="sm"
            className="h-7"
            onClick={onResume}
          >
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
  const canUndoAll = useSyncExternalStore(subscribeSnapshot, hasSnapshot)
  const undoButtonRef = useRef<HTMLButtonElement | null>(null)

  // Undo all disables its own button; the panel keeps the focus instead of it falling to the page.
  // A layout effect, so it runs before the browser drops focus from the disabled button.
  useLayoutEffect(() => {
    if (canUndoAll || document.activeElement !== undoButtonRef.current) return
    sectionRef.current?.focus({ preventScroll: true })
  }, [canUndoAll])

  // Stop and Let it continue replace each other: the one pressed unmounts, so focus moves to the
  // one that takes its place instead of falling to the page.
  const stopButtonRef = useRef<HTMLButtonElement | null>(null)
  const resumeButtonRef = useRef<HTMLButtonElement | null>(null)
  const isTogglingRun = useRef(false)
  const taskStatus = task?.status
  useLayoutEffect(() => {
    if (!isTogglingRun.current) return
    isTogglingRun.current = false
    const target = taskStatus === 'stopped' ? resumeButtonRef.current : stopButtonRef.current
    target?.focus()
  }, [taskStatus])

  const toggleRun = (change: () => void): void => {
    isTogglingRun.current = true
    change()
  }

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
    void undoAll(() => ui.confirm('undo_all'))
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
          // Capped, so a long task never covers the canvas (or, on a phone, the stacked panels);
          // its steps scroll between the header and the footer instead.
          className="pointer-events-auto flex max-h-[32rem] min-h-0 w-72 max-w-full flex-col border max-sm:max-h-[45dvh] bg-background/85 backdrop-blur-md"
        >
          {/* pl-4 puts the header (logo, then heading) on the same left edge as the prompt and steps. */}
          <div className="flex h-9 shrink-0 items-center gap-2 bg-muted/50 pr-1 pl-4">
            <AgentBrandIcon name={task.agent.name} className="size-3.5 text-foreground" />
            <h2 className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              <HeadingText task={task} />
            </h2>
            {task.status === 'active' ? (
              <Button
                ref={stopButtonRef}
                variant="secondary"
                size="sm"
                className="h-7"
                onClick={() => {
                  toggleRun(stopAgent)
                }}
              >
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
          <TaskBody
            task={task}
            resumeButtonRef={resumeButtonRef}
            onResume={() => {
              toggleRun(resumeAgent)
            }}
          />
          <div className="flex shrink-0 items-center justify-end border-t p-1">
            {/* While the task is stopped or over the toolbar control reopens this panel, so the
                connection details (and a new key) are one step away from here instead. */}
            {showsConnectionEntry(task) ? (
              <Button variant="ghost" size="sm" className="mr-auto" onClick={ui.openConnectDialog}>
                {t('agent.panel.connection')}
              </Button>
            ) : null}
            <Button
              ref={undoButtonRef}
              variant="ghost"
              size="sm"
              disabled={!canUndoAll}
              onClick={runUndoAll}
            >
              {t('agent.panel.undoAll')}
            </Button>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  )
}
