import { describe, expect, it } from 'vitest'

import { createUnchangedSharer, shareUnchanged } from './share-unchanged'

interface Element {
  readonly id: string
  readonly position: { readonly x: number; readonly y: number }
  readonly data: { readonly title: string; readonly ports: ReadonlySet<string> }
}

function element(id: string, x: number, title = id): Element {
  return { id, position: { x, y: 0 }, data: { title, ports: new Set(['in']) } }
}

describe('shareUnchanged', () => {
  it('returns the previous array when every element is unchanged', () => {
    const previous = [element('a', 0), element('b', 10)]
    const next = [element('a', 0), element('b', 10)]

    expect(shareUnchanged(previous, next)).toBe(previous)
  })

  it('keeps unchanged elements and the data of moved ones, matched by id', () => {
    const previous = [element('a', 0), element('b', 10), element('c', 20)]
    const next = [element('c', 20), element('b', 15), element('a', 0)]

    const shared = shareUnchanged(previous, next)

    expect(shared).not.toBe(previous)
    expect(shared[0]).toBe(previous[2])
    expect(shared[2]).toBe(previous[0])
    // b moved: a new element (React Flow places it again) around the same data (its view skips).
    expect(shared[1]).not.toBe(previous[1])
    expect(shared[1]?.position).toEqual({ x: 15, y: 0 })
    expect(shared[1]?.data).toBe(previous[1]?.data)
  })

  it('takes the new element whole when its data changed', () => {
    const previous = [element('a', 0)]
    const next = [element('a', 0, 'renamed')]

    const [shared] = shareUnchanged(previous, next)

    expect(shared).toBe(next[0])
  })

  it('keeps the order, length and new elements of the next array', () => {
    const previous = [element('a', 0), element('b', 10)]
    const next = [element('a', 0)]
    expect(shareUnchanged(previous, next)).toEqual(next)

    const added = [element('a', 0), element('b', 10), element('c', 20)]
    const shared = shareUnchanged(previous, added)
    expect(shared).toHaveLength(3)
    expect(shared[2]).toBe(added[2])
  })
})

describe('createUnchangedSharer', () => {
  it('shares each call against the previous call', () => {
    const share = createUnchangedSharer<Element>()
    const first = share([element('a', 0)])
    const second = share([element('a', 0)])
    const third = share([element('a', 5)])

    expect(second).toBe(first)
    expect(third[0]?.data).toBe(first[0]?.data)
    expect(share([element('a', 5)])).toBe(third)
  })
})
