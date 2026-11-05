import type { BridgeRequest } from '@nudo-tsl/agent-protocol'
import { err, ok } from '@nudo-tsl/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { immediateChoreograph } from './choreography'
import { createConfirmBroker } from './confirm-broker'
import { createRequestQueue } from './request-queue'
import type { ToolGate } from './task-machine'
import type { ToolContext, ToolHandler } from './tool-context'

const AGENT = { sessionId: 's1', name: 'agent' }
const context = {
  choreograph: immediateChoreograph,
  onTouch: () => undefined,
  lastTouched: () => null,
  canWrite: () => ok(undefined),
  tidyUp: () => Promise.resolve(),
  confirm: () => Promise.resolve(true),
}

const admitAll: ToolGate = { admit: () => ok(undefined), settle: () => undefined }

const TIMEOUT_MS = 15_000

const request = (
  id: string,
  tool: BridgeRequest['tool'],
  args: unknown = {},
  timeoutMs: number = TIMEOUT_MS,
): BridgeRequest => ({
  kind: 'request',
  id,
  tool,
  args,
  agent: AGENT,
  timeoutMs,
})

afterEach(() => {
  vi.useRealTimers()
})

describe('request queue', () => {
  it('runs requests one at a time in order', async () => {
    const events: string[] = []
    let releaseFirst: () => void = () => undefined
    const first: ToolHandler = async () => {
      events.push('first:start')
      await new Promise<void>((resolve) => {
        releaseFirst = resolve
      })
      events.push('first:end')
      return ok(1)
    }
    const second: ToolHandler = () => {
      events.push('second:start')
      return Promise.resolve(ok(2))
    }
    const queue = createRequestQueue({ get_graph: first, get_code: second }, context, admitAll)

    const a = queue(request('a', 'get_graph'))
    const b = queue(request('b', 'get_code'))
    await Promise.resolve()
    await Promise.resolve()
    expect(events).toEqual(['first:start'])
    releaseFirst()
    const [responseA, responseB] = await Promise.all([a, b])

    expect(events).toEqual(['first:start', 'first:end', 'second:start'])
    expect(responseA).toMatchObject({ id: 'a', ok: true, result: 1 })
    expect(responseB).toMatchObject({ id: 'b', ok: true, result: 2 })
  })

  it('answers invalid args with code invalid and does not call the handler', async () => {
    const handler = vi.fn<ToolHandler>(() => Promise.resolve(ok(null)))
    const queue = createRequestQueue({ add_node: handler }, context, admitAll)

    const response = await queue(request('a', 'add_node', { type: 42 }))

    expect(handler).not.toHaveBeenCalled()
    expect(response).toMatchObject({ id: 'a', ok: false, error: { code: 'invalid' } })
    if (response.ok) throw new Error('expected an error response')
    expect(Array.isArray(response.error.state)).toBe(true)
  })

  it('answers an unknown tool with invalid', async () => {
    const queue = createRequestQueue({}, context, admitAll)
    const response = await queue({ ...request('a', 'get_graph'), tool: 'nope' })

    expect(response).toMatchObject({ ok: false, error: { code: 'invalid' } })
  })

  it('a handler that throws becomes an invalid response, not a crash', async () => {
    const boom: ToolHandler = () => Promise.reject(new Error('boom'))
    const queue = createRequestQueue(
      { get_graph: boom, get_code: () => Promise.resolve(ok('x')) },
      context,
      admitAll,
    )

    const response = await queue(request('a', 'get_graph'))
    const next = await queue(request('b', 'get_code'))

    expect(response).toMatchObject({ ok: false, error: { code: 'invalid', message: 'boom' } })
    expect(next).toMatchObject({ ok: true, result: 'x' })
  })

  it('a refused call answers with the gate error and never reaches the handler', async () => {
    const handler = vi.fn<ToolHandler>(() => Promise.resolve(ok(null)))
    const admit = vi.fn<ToolGate['admit']>(() =>
      err({ code: 'stopped_by_user', message: 'stopped' }),
    )
    const settle = vi.fn<ToolGate['settle']>()
    const queue = createRequestQueue({ add_node: handler }, context, { admit, settle })

    const response = await queue(request('a', 'add_node', { type: 'math/add' }))

    expect(admit).toHaveBeenCalledWith('add_node', AGENT)
    expect(settle).not.toHaveBeenCalled()
    expect(handler).not.toHaveBeenCalled()
    expect(response).toMatchObject({ id: 'a', ok: false, error: { code: 'stopped_by_user' } })
  })

  it('the gate hears that an admitted handler settled, even when it throws', async () => {
    const settle = vi.fn<ToolGate['settle']>()
    const queue = createRequestQueue(
      { get_graph: () => Promise.reject(new Error('boom')) },
      context,
      { admit: () => ok(undefined), settle },
    )

    await queue(request('a', 'get_graph'))

    expect(settle).toHaveBeenCalledWith(AGENT)
  })

  it('drops a request whose timeout passed while it waited in line, without running it', async () => {
    vi.useFakeTimers()
    let releaseFirst: () => void = () => undefined
    const slow: ToolHandler = () =>
      new Promise((resolve) => {
        releaseFirst = () => {
          resolve(ok('slow'))
        }
      })
    const late = vi.fn<ToolHandler>(() => Promise.resolve(ok('late')))
    const admit = vi.fn<ToolGate['admit']>(() => ok(undefined))
    const queue = createRequestQueue({ new_graph: slow, add_node: late }, context, {
      admit,
      settle: () => undefined,
    })

    const first = queue(request('a', 'new_graph', {}, 120_000))
    const second = queue(request('b', 'add_node', { type: 'math/add' }))
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS)
    releaseFirst()

    await expect(first).resolves.toMatchObject({ id: 'a', ok: true })
    await expect(second).resolves.toMatchObject({ id: 'b', ok: false, error: { code: 'timeout' } })
    expect(late).not.toHaveBeenCalled()
    expect(admit).toHaveBeenCalledTimes(1)
  })

  it('declines the open confirmation when its request times out', async () => {
    vi.useFakeTimers()
    const broker = createConfirmBroker()
    const asks: ToolHandler = async (_args, toolContext) =>
      ok(await toolContext.confirm('new_graph'))
    const queue = createRequestQueue(
      { new_graph: asks },
      { ...context, confirm: (kind, signal) => broker.request(kind, signal) },
      admitAll,
    )

    const response = queue(request('a', 'new_graph', {}, 120_000))
    await vi.advanceTimersByTimeAsync(0)
    expect(broker.pending()).toBe('new_graph')
    await vi.advanceTimersByTimeAsync(120_000)

    expect(broker.pending()).toBeNull()
    await expect(response).resolves.toMatchObject({ id: 'a', ok: true, result: false })
  })

  it('refuses writes a handler tries after its request timed out', async () => {
    vi.useFakeTimers()
    let canWriteLater: ReturnType<ToolContext['canWrite']> | null = null
    const waits: ToolHandler = async (_args, toolContext) => {
      await new Promise((resolve) => {
        setTimeout(resolve, TIMEOUT_MS)
      })
      canWriteLater = toolContext.canWrite(AGENT)
      return ok(null)
    }
    const queue = createRequestQueue({ add_node: waits }, context, admitAll)

    const response = queue(request('a', 'add_node', { type: 'math/add' }))
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS)
    await response

    expect(canWriteLater).toMatchObject({ ok: false, error: { code: 'timeout' } })
  })

  it('a validation that throws does not poison the queue', async () => {
    const queue = createRequestQueue(
      { get_code: () => Promise.resolve(ok('x')) },
      context,
      admitAll,
    )
    const brokenRequest = request('a', 'get_code')
    Object.defineProperty(brokenRequest, 'args', {
      get: () => {
        throw new Error('getter exploded')
      },
    })

    const broken = await queue(brokenRequest)
    const next = await queue(request('b', 'get_code'))

    expect(broken).toMatchObject({ ok: false, error: { code: 'invalid' } })
    expect(next).toMatchObject({ ok: true, result: 'x' })
  })
})
