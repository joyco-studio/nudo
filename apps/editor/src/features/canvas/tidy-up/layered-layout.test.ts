import { describe, expect, it } from 'vitest'

import { COLUMN_GAP, ROW_GAP, layeredLayout } from './layered-layout'
import type { LayoutBlock, LayoutInput, LayoutLink } from './layered-layout'

const block = (id: string, x: number, y: number, width = 200, height = 100): LayoutBlock => ({
  id,
  position: { x, y },
  width,
  height,
})

const link = (from: string, to: string, toOffsetY = 50, fromOffsetY = 50): LayoutLink => ({
  from,
  to,
  fromOffsetY,
  toOffsetY,
})

type Box = { x: number; y: number; width: number; height: number }

function boxesOf(input: LayoutInput, positions: ReadonlyMap<string, { x: number; y: number }>) {
  return new Map(
    input.blocks.map((item): [string, Box] => {
      const position = positions.get(item.id) ?? item.position
      return [item.id, { ...position, width: item.width, height: item.height }]
    }),
  )
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/** A scrambled shader: two chains into a master, one shared source, one loose end, one island. */
const SCRAMBLED: LayoutInput = {
  sinkId: 'master',
  blocks: [
    block('master', 600, 0, 260, 400),
    block('time', 900, 500),
    block('speed', -300, 40, 180, 40),
    block('multiply', 100, 700),
    block('position', 500, 300),
    block('add', 0, 0),
    block('noise', 300, 900),
    block('color', 50, 450),
    block('loose', 200, 200),
    block('island', 700, 700),
  ],
  links: [
    link('time', 'multiply'),
    link('speed', 'multiply', 80, 20),
    link('position', 'add'),
    link('multiply', 'add', 80),
    link('add', 'noise'),
    link('noise', 'master', 300),
    link('color', 'master', 60),
    link('position', 'loose'),
  ],
}

describe('layeredLayout', () => {
  const positions = layeredLayout(SCRAMBLED)
  const boxes = boxesOf(SCRAMBLED, positions)

  it('runs every link left to right, a whole column gap apart', () => {
    for (const { from, to } of SCRAMBLED.links) {
      const source = boxes.get(from)
      const target = boxes.get(to)
      if (source === undefined || target === undefined) throw new Error('missing block')
      expect(source.x + source.width + COLUMN_GAP, `${from} → ${to}`).toBeLessThanOrEqual(target.x)
    }
  })

  it('keeps the sink where it was, in the last column', () => {
    expect(positions.get('master')).toEqual({ x: 600, y: 0 })
    const master = boxes.get('master')
    for (const [id, box] of boxes) {
      if (id === 'master' || id === 'island') continue
      expect(box.x, id).toBeLessThan(master?.x ?? 0)
    }
  })

  it('puts sources in deeper columns than what they feed: the longest path decides', () => {
    expect(boxes.get('position')?.x).toBe(boxes.get('multiply')?.x)
    expect(boxes.get('time')?.x).toBeLessThan(boxes.get('multiply')?.x ?? 0)
    expect(boxes.get('color')?.x).toBe(boxes.get('noise')?.x)
  })

  it('leaves no two blocks overlapping, with a row gap between neighbors in a column', () => {
    const all = [...boxes.entries()]
    for (const [index, [id, box]] of all.entries()) {
      for (const [otherId, other] of all.slice(index + 1)) {
        expect(overlaps(box, other), `${id} / ${otherId}`).toBe(false)
      }
    }
    const noise = boxes.get('noise')
    const color = boxes.get('color')
    if (noise === undefined || color === undefined) throw new Error('missing block')
    expect(noise.y).toBeGreaterThanOrEqual(color.y + color.height + ROW_GAP)
  })

  it('orders a column by where its links land, so wires into the sink do not cross', () => {
    // color feeds the master at 60 px, noise at 300 px: color sits above noise.
    expect(boxes.get('color')?.y).toBeLessThan(boxes.get('noise')?.y ?? 0)
  })

  it('aligns a lone link: the source port lines up with the port it feeds', () => {
    const noise = boxes.get('noise')
    const add = boxes.get('add')
    if (noise === undefined || add === undefined) throw new Error('missing block')
    expect(add.y + 50).toBe(noise.y + 50)
  })

  it('stacks blocks that want the same spot a row gap apart, centered on that spot', () => {
    const input: LayoutInput = {
      sinkId: 'sink',
      blocks: [block('sink', 0, 0), block('b', -500, 90), block('a', -500, 10)],
      links: [link('a', 'sink'), link('b', 'sink')],
    }
    const result = boxesOf(input, layeredLayout(input))
    const a = result.get('a')
    const b = result.get('b')
    if (a === undefined || b === undefined) throw new Error('missing block')
    // Same wish: the order they had on the canvas decides, top to bottom.
    expect(b.y - (a.y + a.height)).toBe(ROW_GAP)
    expect((a.y + b.y) / 2).toBe(0)
  })

  it('moves blocks without links into a row under the layout', () => {
    const island = boxes.get('island')
    const lowest = Math.max(
      ...[...boxes.entries()]
        .filter(([id]) => id !== 'island')
        .map(([, box]) => box.y + box.height),
    )
    expect(island?.y).toBeGreaterThan(lowest)
  })

  it('is deterministic', () => {
    expect([...layeredLayout(SCRAMBLED)]).toEqual([...positions])
  })

  it('places whole pixels', () => {
    for (const position of positions.values()) {
      expect(Number.isInteger(position.x) && Number.isInteger(position.y)).toBe(true)
    }
  })

  it('survives a cycle (frames grouped into one block can make one) and keeps every block', () => {
    const cyclic: LayoutInput = {
      sinkId: null,
      blocks: [block('a', 0, 0), block('b', 300, 0), block('c', 600, 0)],
      links: [link('a', 'b'), link('b', 'c'), link('c', 'a')],
    }
    expect([...layeredLayout(cyclic).keys()].sort()).toEqual(['a', 'b', 'c'])
  })

  it('without a sink, keeps the top-left corner of what it lays out', () => {
    const input: LayoutInput = {
      sinkId: null,
      blocks: [block('b', 500, 300), block('a', 100, 200)],
      links: [link('a', 'b')],
    }
    const result = boxesOf(input, layeredLayout(input))
    const left = Math.min(...[...result.values()].map((box) => box.x))
    const top = Math.min(...[...result.values()].map((box) => box.y))
    expect({ left, top }).toEqual({ left: 100, top: 200 })
  })
})
