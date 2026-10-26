import {
  addNode,
  asNodeId,
  createGraph,
  createNodeRegistry,
  setInputValue,
  texture,
} from '@nudo-tsl/core'
import type { Graph, NodeRegistry, PortRef, Result } from '@nudo-tsl/core'
import { createDefaultRegistry } from '@nudo-tsl/nodes'
import { MeshBasicNodeMaterial, Node } from 'three/webgpu'
import { describe, expect, it } from 'vitest'
import { createPreviewMaterial } from './create-preview-material'

const ORIGIN = { x: 0, y: 0 }

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const withNode = (graph: Graph, registry: NodeRegistry, id: string, type: string): Graph =>
  unwrap(addNode(graph, registry, { id: asNodeId(id), type, position: ORIGIN }))

const outputOf = (nodeId: string, portId: string): PortRef => ({
  nodeId: asNodeId(nodeId),
  portId,
})

describe('createPreviewMaterial', () => {
  const registry = createDefaultRegistry()

  it('builds an opaque unlit material for a float output', () => {
    const graph = withNode(createGraph(), registry, 'amount', 'input/float')

    const build = createPreviewMaterial(graph, registry, outputOf('amount', 'out'))

    expect(build.errors).toEqual([])
    expect(build.material).toBeInstanceOf(MeshBasicNodeMaterial)
    expect(build.material?.transparent).toBe(false)
    expect(build.material?.colorNode).toBeInstanceOf(Node)
    expect(build.material).toHaveProperty('opacityNode', null)
  })

  it.each([
    ['input/float', 'out'],
    ['input/uv', 'out'],
    ['input/color', 'out'],
    ['input/vector4', 'out'],
  ] as const)('builds a color for the %s output', (type, port) => {
    const graph = withNode(createGraph(), registry, 'subject', type)

    const build = createPreviewMaterial(graph, registry, outputOf('subject', port))

    expect(build.errors).toEqual([])
    expect(build.material?.colorNode).toBeInstanceOf(Node)
  })

  it('previews a texture output through its rgb', () => {
    let graph = withNode(createGraph(), registry, 'sample', 'texture/sample-texture-2d')
    graph = unwrap(
      setInputValue(graph, { nodeId: asNodeId('sample'), portId: 'texture' }, texture('asset')),
    )

    const build = createPreviewMaterial(graph, registry, outputOf('sample', 'rgb'), {
      resolveTexture: () => null,
    })

    expect(build.errors).toEqual([])
    expect(build.missingTextures).toEqual(['asset'])
  })

  it('keeps inline values live through uniforms', () => {
    const graph = withNode(createGraph(), registry, 'amount', 'input/float')

    const build = createPreviewMaterial(graph, registry, outputOf('amount', 'out'))

    expect([...build.uniforms.keys()]).toEqual(['amount:x'])
  })

  it('reports compile errors without a material', () => {
    const build = createPreviewMaterial(createGraph(), createNodeRegistry(), outputOf('x', 'out'))

    expect(build.material).toBeNull()
    expect(build.errors.length).toBeGreaterThan(0)
  })
})
