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

  it('declines a second question while one is open, leaving the first one asked', async () => {
    const broker = createConfirmBroker()
    const first = broker.request('load_template')

    await expect(broker.request('undo_all')).resolves.toBe(false)
    expect(broker.pending()).toBe('load_template')

    broker.answer(false)
    await expect(first).resolves.toBe(false)
  })
})
