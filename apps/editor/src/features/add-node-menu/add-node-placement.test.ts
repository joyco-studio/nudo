import { describe, expect, it } from 'vitest'

import {
  BESIDE_NODE_OFFSET_X,
  NEW_NODE_SIZE,
  PLACEMENT_GAP,
  besideNode,
  findFreeSpot,
} from './add-node-placement'

describe('add-node placement', () => {
  it('puts a new node 260 px to the right of the focused node, on the same row', () => {
    expect(BESIDE_NODE_OFFSET_X).toBe(260)
    expect(besideNode({ x: 200, y: 40 })).toEqual({ x: 460, y: 40 })
  })

  it('keeps the wanted spot when nothing is there', () => {
    const others = [{ x: 0, y: 0, width: 100, height: 100 }]
    expect(findFreeSpot({ x: 500, y: 500 }, others)).toEqual({ x: 500, y: 500 })
  })

  it('moves right past every node it would cover, so new nodes never stack', () => {
    const master = { x: 600, y: 0, width: 256, height: 700 }
    const time = { x: 600 + 256 + PLACEMENT_GAP, y: 450, ...NEW_NODE_SIZE }
    expect(findFreeSpot({ x: 720, y: 450 }, [master])).toEqual({
      x: 600 + 256 + PLACEMENT_GAP,
      y: 450,
    })
    expect(findFreeSpot({ x: 720, y: 450 }, [master, time])).toEqual({
      x: time.x + time.width + PLACEMENT_GAP,
      y: 450,
    })
  })
})
