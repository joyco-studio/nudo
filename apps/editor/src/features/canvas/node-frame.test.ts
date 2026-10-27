import { asNodeId } from '@nudo-tsl/core'
import type { GraphNode } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { registry } from '@/store/registry'

import { frameOf, resizedFrame, sizedFrame } from './node-frame'

function nodeOf(type: string, params: GraphNode['params'] = {}): GraphNode {
  return { id: asNodeId('n'), type, position: { x: 10, y: 20 }, inputValues: {}, params }
}

function definitionOf(type: string) {
  const definition = registry.get(type)
  if (definition === undefined) throw new Error(`Missing ${type}`)
  return definition
}

describe('frameOf', () => {
  it('reads a comment frame from its params, with defaults and minimums', () => {
    const node = nodeOf('utility/comment', { width: 400 })
    expect(frameOf(node, definitionOf('utility/comment'))).toEqual({
      position: { x: 10, y: 20 },
      width: 400,
      height: 200,
      minWidth: 120,
      minHeight: 80,
    })
  })

  it('is null for nodes that size to their content', () => {
    expect(frameOf(nodeOf('math/sin'), definitionOf('math/sin'))).toBeNull()
  })
})

describe('resizedFrame', () => {
  const frame = {
    position: { x: 0, y: 0 },
    width: 130,
    height: 90,
    minWidth: 120,
    minHeight: 80,
  }

  it('grows and shrinks by the delta, never below the minimum size', () => {
    expect(resizedFrame(frame, { width: 20, height: 0 })).toEqual({
      position: { x: 0, y: 0 },
      width: 150,
      height: 90,
    })
    expect(resizedFrame(frame, { width: -20, height: -20 })).toEqual({
      position: { x: 0, y: 0 },
      width: 120,
      height: 80,
    })
  })
})

describe('sizedFrame', () => {
  const frame = {
    position: { x: 5, y: 6 },
    width: 320,
    height: 200,
    minWidth: 120,
    minHeight: 80,
  }

  it('takes the typed size and keeps the position', () => {
    expect(sizedFrame(frame, { width: 400 })).toEqual({
      position: { x: 5, y: 6 },
      width: 400,
      height: 200,
    })
    expect(sizedFrame(frame, { height: 260 })).toEqual({
      position: { x: 5, y: 6 },
      width: 320,
      height: 260,
    })
  })

  it('never goes below the minimum size', () => {
    expect(sizedFrame(frame, { width: 10, height: -5 })).toEqual({
      position: { x: 5, y: 6 },
      width: 120,
      height: 80,
    })
  })

  it('rounds a typed or scrubbed size to whole pixels', () => {
    expect(sizedFrame(frame, { width: 400.6, height: 250.2 })).toEqual({
      position: { x: 5, y: 6 },
      width: 401,
      height: 250,
    })
  })
})
