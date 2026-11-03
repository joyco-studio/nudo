import type { MessageKey } from '@/i18n/translate'
import type { AgentTask } from '@/store/store-types'

import type { ConnectionStatus } from './bridge-client'

/** What the toolbar control shows: an offer to connect, the connection, or the agent's work. */
export type ChipView =
  | { readonly kind: 'connect' }
  | { readonly kind: 'connecting' }
  | { readonly kind: 'other-tab' }
  | { readonly kind: 'connected'; readonly hasLastTask: boolean }
  | {
      readonly kind: 'working'
      readonly agentName: string
      readonly step: string | null
      readonly startedAt: number
    }
  | { readonly kind: 'stopped'; readonly agentName: string; readonly step: string | null }

const currentStepLabel = (task: AgentTask): string | null =>
  task.steps.find((step) => step.state === 'current')?.label ?? null

/** A task in progress wins over the connection; finished, it only lets "connected" reopen it. */
export function chipViewOf(status: ConnectionStatus, task: AgentTask | null): ChipView {
  if (task?.status === 'active') {
    return {
      kind: 'working',
      agentName: task.agent.name,
      step: currentStepLabel(task),
      startedAt: task.startedAt,
    }
  }
  if (task?.status === 'stopped') {
    return { kind: 'stopped', agentName: task.agent.name, step: currentStepLabel(task) }
  }
  switch (status) {
    case 'connected':
      return { kind: 'connected', hasLastTask: task !== null }
    case 'connecting':
      return { kind: 'connecting' }
    case 'other-tab':
      return { kind: 'other-tab' }
    case 'off':
    case 'unreachable':
    case 'bad-key':
    case 'outdated':
      return { kind: 'connect' }
  }
}

/** Whether the control toggles the activity panel; otherwise it opens the connect dialog. */
export function opensActivityPanel(view: ChipView): boolean {
  if (view.kind === 'working' || view.kind === 'stopped') return true
  return view.kind === 'connected' && view.hasLastTask
}

/**
 * Whether the activity panel offers the connection details. Not while the agent works (the panel
 * is about its work then), but as soon as it is stopped, so a leaked key can be replaced without
 * letting the agent continue first.
 */
export function showsConnectionEntry(task: AgentTask): boolean {
  return task.status !== 'active'
}

/** The connection in words, for the connect dialog. */
export function connectionStatusKey(status: ConnectionStatus, isConfigured: boolean): MessageKey {
  if (!isConfigured) return 'agent.status.notConfigured'
  switch (status) {
    case 'off':
      return 'agent.status.off'
    case 'connecting':
      return 'agent.status.connecting'
    case 'connected':
      return 'agent.status.connected'
    case 'other-tab':
      return 'agent.status.otherTab'
    case 'bad-key':
      return 'agent.status.badKey'
    case 'outdated':
      return 'agent.status.outdated'
    case 'unreachable':
      return 'agent.status.unreachable'
  }
}

/** The command that adds nudo to Claude Code with this key. */
export function connectCommand(url: string, key: string): string {
  return `claude mcp add --transport http nudo ${url}/mcp --header "Authorization: Bearer ${key}"`
}

/**
 * The Worker URL from the build env, without a trailing slash; null when it is missing or is not
 * an http(s) URL, so the editor says the connection is not set up instead of failing.
 */
export function bridgeUrlFrom(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (trimmed === '') return null
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? trimmed : null
  } catch {
    return null
  }
}

/** The WebSocket URL for an http(s) one: `https:` becomes `wss:`, `http:` becomes `ws:`. */
export function toSocketUrl(httpUrl: string): string {
  return httpUrl.replace(/^http/, 'ws')
}

/** What a change of task does to the activity panel: a new task opens it, the end collapses it. */
export type PanelChange = 'open' | 'collapse' | null

export function panelChangeFor(previous: AgentTask | null, next: AgentTask | null): PanelChange {
  if (next === null) return previous === null ? null : 'collapse'
  if (next.status === 'finished') return previous?.status === 'finished' ? null : 'collapse'
  if (next.status !== 'active') return null
  const isNewTask = previous === null || previous.startedAt !== next.startedAt
  return isNewTask || previous.status === 'finished' ? 'open' : null
}

/** What pressing the toolbar control does to the activity panel. */
export type ChipPress = 'open' | 'focus' | 'collapse'

/**
 * A closed panel opens with focus inside. A panel the task opened by itself has never held the
 * person's focus, so the first press takes them into it instead of hiding what they came to read;
 * once they have been there, the control hides it again, like any disclosure.
 */
export function chipPressFor(isPanelOpen: boolean, wasOpenedByTask: boolean): ChipPress {
  if (!isPanelOpen) return 'open'
  return wasOpenedByTask ? 'focus' : 'collapse'
}
