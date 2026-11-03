import { Bot, Plug } from 'lucide-react'

import type { MessageKey } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { useEditorStore } from '@/store/editor-store'

import { useAgentUi } from './agent-ui-context'
import { chipViewOf, opensActivityPanel } from './agent-ui-model'
import type { ChipView } from './agent-ui-model'
import { useTaskTimer } from './use-task-timer'

const DOT_DELAYS_MS = [0, 160, 320] as const

/** Three dots that pulse in turn while the agent works; still under reduced motion. */
function WorkingDots() {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center gap-0.5">
      {DOT_DELAYS_MS.map((delay) => (
        <span
          key={delay}
          className="size-1 rounded-full bg-agent animate-pulse motion-reduce:animate-none"
          style={{ animationDelay: `${String(delay)}ms` }}
        />
      ))}
    </span>
  )
}

const IDLE_LABELS: Readonly<
  Record<'connect' | 'connecting' | 'other-tab' | 'connected', MessageKey>
> = {
  connect: 'agent.chip.connect',
  connecting: 'agent.chip.connecting',
  'other-tab': 'agent.chip.otherTab',
  connected: 'agent.chip.connected',
}

function tooltipKey(view: ChipView): MessageKey {
  if (view.kind === 'working' || view.kind === 'stopped') return 'agent.chip.tooltipActivity'
  if (view.kind === 'connected' && view.hasLastTask) return 'agent.chip.tooltipLastTask'
  return 'agent.chip.tooltipConnect'
}

function ChipContent({ view }: { view: ChipView }) {
  const t = useT()
  const elapsed = useTaskTimer(
    view.kind === 'working' ? view.startedAt : null,
    view.kind === 'working',
  )

  if (view.kind === 'working' || view.kind === 'stopped') {
    const isWorking = view.kind === 'working'
    const label = view.step ?? t(isWorking ? 'agent.chip.working' : 'agent.chip.stopped')
    return (
      <>
        {isWorking ? <WorkingDots /> : null}
        <span className="max-w-48 truncate max-sm:max-w-24">
          {isWorking || view.step === null ? label : `${t('agent.chip.stopped')} · ${label}`}
        </span>
        {/* The time is in the panel header too; here it would change the name every second. */}
        {isWorking ? (
          <span aria-hidden="true" className="font-mono text-micro tabular-nums opacity-80">
            {elapsed}
          </span>
        ) : null}
      </>
    )
  }

  const Icon = view.kind === 'connected' ? Bot : Plug
  return (
    <>
      <Icon aria-hidden="true" />
      <span className="max-sm:sr-only">{t(IDLE_LABELS[view.kind])}</span>
    </>
  )
}

/**
 * The agent's place in the toolbar. One button throughout, so focus can always come back to it:
 * "Connect an agent" opens the connect dialog; during a task it shows the current step and timer
 * and shows or hides the activity panel (a disclosure); afterwards "Agent connected" reopens the
 * last task until the next one starts.
 */
export function AgentWorkChip() {
  const t = useT()
  const { registerChip, isPanelOpen, panelId, togglePanel, openConnectDialog } = useAgentUi()
  const status = useEditorStore((state) => state.agentConnection)
  const task = useEditorStore((state) => state.agentTask)
  const view = chipViewOf(status, task)
  const isDisclosure = opensActivityPanel(view)
  const isBusy = view.kind === 'working' || view.kind === 'stopped'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={registerChip}
          variant="accent"
          size="sm"
          static
          aria-expanded={isDisclosure ? isPanelOpen : undefined}
          aria-controls={isDisclosure && isPanelOpen ? panelId : undefined}
          aria-haspopup={isDisclosure ? undefined : 'dialog'}
          className={cn(
            'min-w-0',
            isBusy &&
              'bg-agent-soft text-agent hover:bg-agent-soft hover:text-agent focus-visible:ring-agent/50',
          )}
          onClick={isDisclosure ? togglePanel : openConnectDialog}
        >
          <ChipContent view={view} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t(tooltipKey(view))}</TooltipContent>
    </Tooltip>
  )
}
