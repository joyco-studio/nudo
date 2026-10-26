import { describe, expect, it } from 'vitest'

import { BESIDE_NODE_OFFSET_X, besideNode, rectCenter } from './add-node-placement'

describe('add-node placement', () => {
  it('puts a new node 260 px to the right of the focused node, on the same row', () => {
    expect(BESIDE_NODE_OFFSET_X).toBe(260)
    expect(besideNode({ x: 200, y: 40 })).toEqual({ x: 460, y: 40 })
  })

  it('finds the center of a client rect', () => {
    expect(rectCenter({ left: 10, top: 20, width: 100, height: 50 })).toEqual({ x: 60, y: 45 })
  })
})
