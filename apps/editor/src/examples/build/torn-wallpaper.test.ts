import { asEdgeId, asNodeId, connect } from '@nudo-tsl/core'
import { createMaterial } from '@nudo-tsl/runtime'
import { describe, expect, it } from 'vitest'

import { registry } from '@/store/registry'

import { buildExampleGraph } from './build-example-graph'
import { TORN_WALLPAPER } from './torn-wallpaper'

const graph = buildExampleGraph(TORN_WALLPAPER, registry)
const shapeInput = { nodeId: asNodeId('shapeInput'), portId: 'in' }
const sourceIds = ['textureOutput', 'ellipseOutput', 'boxOutput'] as const

describe('interchangeable torn wallpaper shapes', () => {
  it('starts with exactly the texture source connected, with no layout-only wires saved', () => {
    const inputs = Object.values(graph.edges).filter((edge) => edge.to.nodeId === shapeInput.nodeId)
    expect(inputs).toHaveLength(1)
    expect(inputs[0]?.from).toEqual({ nodeId: 'textureOutput', portId: 'vec3' })
    expect(Object.values(graph.edges).filter((edge) => edge.id.startsWith('layout-'))).toEqual([])
    for (const source of sourceIds.slice(1)) {
      expect(Object.values(graph.edges).filter((edge) => edge.from.nodeId === source)).toEqual([])
    }
  })

  it('keeps the three source frames together in one column, before the shared input', () => {
    const frames = ['shape-texture', 'shape-ellipse', 'shape-box'].map((id) => {
      const frame = graph.nodes[asNodeId(`frame-${id}`)]
      if (!frame) throw new Error(`Missing frame ${id}`)
      return frame
    })
    const rightEdges = frames.map((frame) => frame.position.x + Number(frame.params.width))
    const [texture, ellipse, box] = frames
    const input = graph.nodes[asNodeId('frame-shape-input')]
    if (!texture || !ellipse || !box || !input) throw new Error('Missing shape frame')
    expect(new Set(rightEdges).size).toBe(1)
    expect(texture.position.y).toBeLessThan(ellipse.position.y)
    expect(ellipse.position.y).toBeLessThan(box.position.y)
    expect(rightEdges[0]).toBeLessThan(input.position.x)
  })

  it.each(sourceIds)('switches to %s by replacing only one wire, and compiles', (source) => {
    const swapped = connect(graph, registry, {
      id: asEdgeId(`select-${source}`),
      from: { nodeId: asNodeId(source), portId: 'vec3' },
      to: shapeInput,
    })
    if (!swapped.ok) throw new Error(JSON.stringify(swapped.error))
    expect(Object.keys(swapped.value.edges)).toHaveLength(Object.keys(graph.edges).length)
    expect(
      Object.values(swapped.value.edges).filter((edge) => edge.to.nodeId === shapeInput.nodeId),
    ).toHaveLength(1)
    const material = createMaterial(swapped.value, registry)
    expect(material.errors).toEqual([])
    material.material?.dispose()
  })
})
