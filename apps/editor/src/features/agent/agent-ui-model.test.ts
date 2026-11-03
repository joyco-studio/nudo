import { describe, expect, it } from 'vitest'

import type { AgentTask } from '@/store/store-types'

import {
  bridgeUrlFrom,
  chipViewOf,
  connectionStatusKey,
  opensActivityPanel,
  chipPressFor,
  panelChangeFor,
  showsConnectionEntry,
  toSocketUrl,
} from './agent-ui-model'

const task = (status: AgentTask['status']): AgentTask => ({
  agent: { sessionId: 's1', name: 'Claude' },
  prompt: null,
  implicit: true,
  startedAt: 5,
  steps: [{ label: 'Adding Voronoi', detail: null, state: 'current' }],
  status,
  createdNodeIds: [],
  summary: null,
})

describe('chipViewOf', () => {
  it('shows the work while a task is active or stopped, whatever the connection', () => {
    expect(chipViewOf('unreachable', task('active'))).toEqual({
      kind: 'working',
      agentName: 'Claude',
      step: 'Adding Voronoi',
      startedAt: 5,
    })
    expect(chipViewOf('connected', task('stopped')).kind).toBe('stopped')
  })

  it('offers to connect when off, unreachable, rejected or outdated', () => {
    for (const status of ['off', 'unreachable', 'bad-key', 'outdated'] as const) {
      expect(chipViewOf(status, null)).toEqual({ kind: 'connect' })
    }
  })

  it('lets the connected control reopen the last task until the next one starts', () => {
    const view = chipViewOf('connected', task('finished'))
    expect(view).toEqual({ kind: 'connected', hasLastTask: true })
    expect(opensActivityPanel(view)).toBe(true)
    expect(opensActivityPanel(chipViewOf('connected', null))).toBe(false)
  })
})

describe('connection details', () => {
  it('are offered from the panel once the task is stopped or finished, not while it runs', () => {
    expect(showsConnectionEntry(task('active'))).toBe(false)
    expect(showsConnectionEntry(task('stopped'))).toBe(true)
    expect(showsConnectionEntry(task('finished'))).toBe(true)
  })

  it('says the connection is not set up before anything else', () => {
    expect(connectionStatusKey('connected', false)).toBe('agent.status.notConfigured')
    expect(connectionStatusKey('outdated', true)).toBe('agent.status.outdated')
  })

  it('accepts only http(s) urls and drops the trailing slash', () => {
    expect(bridgeUrlFrom('https://mcp.example.dev/')).toBe('https://mcp.example.dev')
    expect(bridgeUrlFrom(undefined)).toBeNull()
    expect(bridgeUrlFrom('  ')).toBeNull()
    expect(bridgeUrlFrom('ftp://x')).toBeNull()
    expect(toSocketUrl('https://mcp.example.dev/bridge/abc')).toBe(
      'wss://mcp.example.dev/bridge/abc',
    )
    expect(toSocketUrl('http://localhost:8787')).toBe('ws://localhost:8787')
  })
})

describe('panelChangeFor', () => {
  it('opens for a new task and collapses when it finishes', () => {
    expect(panelChangeFor(null, task('active'))).toBe('open')
    expect(panelChangeFor(task('active'), task('finished'))).toBe('collapse')
    expect(panelChangeFor(task('finished'), task('finished'))).toBeNull()
    expect(panelChangeFor(task('finished'), { ...task('active'), startedAt: 9 })).toBe('open')
  })

  it('leaves the panel as it is when the person stops and resumes the agent', () => {
    expect(panelChangeFor(task('active'), task('stopped'))).toBeNull()
    expect(panelChangeFor(task('stopped'), task('active'))).toBeNull()
  })
})

describe('chipPressFor', () => {
  it('opens a closed panel', () => {
    expect(chipPressFor(false, false)).toBe('open')
    expect(chipPressFor(false, true)).toBe('open')
  })

  it('takes focus into a panel the task opened, and hides one the person has been in', () => {
    expect(chipPressFor(true, true)).toBe('focus')
    expect(chipPressFor(true, false)).toBe('collapse')
  })
})
