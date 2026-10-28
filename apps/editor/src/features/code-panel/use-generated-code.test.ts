import { createGraph } from '@nudo-tsl/core'
import type { Graph } from '@nudo-tsl/core'
import type { GeneratedModule } from '@nudo-tsl/codegen'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CODE_DEBOUNCE_MS, createGeneratedCodeSource } from './use-generated-code'
import type { GraphFeed } from './use-generated-code'

/** A graph feed the test drives by hand. */
function manualFeed(initial: Graph) {
  let graph = initial
  const listeners = new Set<() => void>()
  const feed: GraphFeed = {
    read: () => graph,
    subscribe: (onChange) => {
      listeners.add(onChange)
      return () => {
        listeners.delete(onChange)
      }
    },
  }
  const replace = (next: Graph): void => {
    graph = next
    for (const listener of listeners) listener()
  }
  return { feed, replace, listenerCount: () => listeners.size }
}

/** A copy of the graph, as any store edit makes: a new object. */
const edited = (graph: Graph): Graph => ({ ...graph })

describe('createGeneratedCodeSource', () => {
  let printed: Map<Graph, string>
  const generate = vi.fn((graph: Graph): GeneratedModule => ({
    code: printed.get(graph) ?? 'initial',
    errors: [],
  }))

  beforeEach(() => {
    vi.useFakeTimers()
    printed = new Map()
    generate.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('generates the first module at once', () => {
    const { feed } = manualFeed(createGraph())
    const source = createGeneratedCodeSource(feed, generate)

    expect(source.getSnapshot().code).toBe('initial')
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('regenerates once per burst of edits, after the debounce', () => {
    const { feed, replace } = manualFeed(createGraph())
    const source = createGeneratedCodeSource(feed, generate)
    const listener = vi.fn()
    source.getSnapshot()
    source.subscribe(listener)

    const first = edited(feed.read())
    const second = edited(first)
    printed.set(second, 'connected')
    replace(first)
    vi.advanceTimersByTime(CODE_DEBOUNCE_MS - 1)
    replace(second)
    vi.advanceTimersByTime(CODE_DEBOUNCE_MS - 1)

    expect(source.getSnapshot().code).toBe('initial')
    expect(listener).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)

    expect(source.getSnapshot().code).toBe('connected')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('keeps the same snapshot when the module prints the same (a node moved)', () => {
    const { feed, replace } = manualFeed(createGraph())
    const source = createGeneratedCodeSource(feed, generate)
    const listener = vi.fn()
    const before = source.getSnapshot()
    source.subscribe(listener)

    replace(edited(feed.read()))
    vi.advanceTimersByTime(CODE_DEBOUNCE_MS)

    expect(source.getSnapshot()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops following the graph without readers, and catches up when read again', () => {
    const { feed, replace, listenerCount } = manualFeed(createGraph())
    const source = createGeneratedCodeSource(feed, generate)
    source.getSnapshot()
    const unsubscribe = source.subscribe(vi.fn())
    unsubscribe()

    expect(listenerCount()).toBe(0)

    const next = edited(feed.read())
    printed.set(next, 'later')
    replace(next)

    expect(source.getSnapshot().code).toBe('later')
  })

  it('catches an edit made between the first read and the subscription', () => {
    const { feed, replace } = manualFeed(createGraph())
    const source = createGeneratedCodeSource(feed, generate)
    source.getSnapshot()
    const next = edited(feed.read())
    printed.set(next, 'meanwhile')
    replace(next)
    const listener = vi.fn()
    source.subscribe(listener)

    vi.advanceTimersByTime(CODE_DEBOUNCE_MS)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(source.getSnapshot().code).toBe('meanwhile')
  })
})
