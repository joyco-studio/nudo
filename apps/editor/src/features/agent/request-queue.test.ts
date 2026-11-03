import type { BridgeRequest } from '@nudo-tsl/agent-protocol'
import { err, ok } from '@nudo-tsl/core'
import { describe, expect, it, vi } from 'vitest'
import { immediateChoreograph } from './choreography'
import { createRequestQueue } from './request-queue'
import type { ToolGate } from './task-machine'
import type { ToolHandler } from './tool-context'

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

const request = (id: string, tool: BridgeRequest['tool'], args: unknown = {}): BridgeRequest => ({
  kind: 'request',
  id,
  tool,
  args,
  agent: AGENT,
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
