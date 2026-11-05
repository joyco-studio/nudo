import { describe, expect, it, vi } from 'vitest'

import { createConfirmBroker } from './confirm-broker'

describe('confirm broker', () => {
  it('publishes the pending question and resolves it with the answer', async () => {
    const broker = createConfirmBroker()
    const listener = vi.fn()
    broker.subscribe(listener)

    const answer = broker.request('new_graph')
    expect(broker.pending()).toBe('new_graph')
    expect(listener).toHaveBeenCalledTimes(1)

    broker.answer(true)
    await expect(answer).resolves.toBe(true)
    expect(broker.pending()).toBeNull()
  })

  it('declines the open question when its signal aborts, and closes it', async () => {
    const broker = createConfirmBroker()
    const controller = new AbortController()
    const answer = broker.request('new_graph', controller.signal)
    expect(broker.pending()).toBe('new_graph')

    controller.abort()

    await expect(answer).resolves.toBe(false)
    expect(broker.pending()).toBeNull()
  })

  it('declines at once when the signal already aborted', async () => {
    const broker = createConfirmBroker()
    await expect(broker.request('new_graph', AbortSignal.abort())).resolves.toBe(false)
    expect(broker.pending()).toBeNull()
  })

  it('an abort after the person answered changes nothing', async () => {
    const broker = createConfirmBroker()
    const controller = new AbortController()
    const answer = broker.request('new_graph', controller.signal)
    broker.answer(true)
    const next = broker.request('undo_all')

    controller.abort()

    await expect(answer).resolves.toBe(true)
    expect(broker.pending()).toBe('undo_all')
    broker.answer(false)
    await expect(next).resolves.toBe(false)
  })

  it('declines a second question while one is open, leaving the first one asked', async () => {
    const broker = createConfirmBroker()
    const first = broker.request('load_template')

    await expect(broker.request('undo_all')).resolves.toBe(false)
    expect(broker.pending()).toBe('load_template')

    broker.answer(false)
    await expect(first).resolves.toBe(false)
  })
})
