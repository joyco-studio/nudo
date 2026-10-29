import {
  addNode,
  addProperty,
  asNodeId,
  asPropertyId,
  createGraph,
  setInputValue,
  texture,
} from '@nudo-tsl/core'
import type { Graph, PortValue } from '@nudo-tsl/core'
import { generateModule } from '@nudo-tsl/codegen'
import { describe, expect, it } from 'vitest'

import { registry } from '@/store/registry'

import { bindTemplateTextures, templateTexturesIn } from './bind-template-textures'
import { templateTexture, templateTextureIdOf, templateTextureRef } from './template-texture'

const GRAIN_ASSET = 'a'.repeat(64)
const USER_ASSET = 'b'.repeat(64)
const SAMPLE_ID = asNodeId('sample')
const ORIGIN = { x: 0, y: 0 }

function expectOk<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

/** A Sample Texture 2D with `slot` inline, and a texture property holding `property`. */
function graphWith(slot: PortValue, property: PortValue): Graph {
  const withNode = expectOk(
    addNode(createGraph(), registry, {
      id: SAMPLE_ID,
      type: 'texture/sample-texture-2d',
      position: ORIGIN,
    }),
  )
  const withSlot = expectOk(setInputValue(withNode, { nodeId: SAMPLE_ID, portId: 'texture' }, slot))
  return expectOk(
    addProperty(withSlot, {
      id: asPropertyId('grain'),
      label: 'Grain',
      name: 'grain',
      exposed: true,
      type: 'texture',
      value: property,
    }),
  )
}

const slotOf = (graph: Graph): PortValue | undefined => graph.nodes[SAMPLE_ID]?.inputValues.texture

describe('template texture references', () => {
  it('names a template texture in an asset slot, and reads the name back', () => {
    expect(templateTexture('paper-grain')).toEqual({
      type: 'texture',
      assetId: templateTextureRef('paper-grain'),
    })
    expect(templateTextureIdOf(templateTextureRef('paper-grain'))).toBe('paper-grain')
  })

  it('tells a stored asset and an empty slot apart from a template texture', () => {
    expect(templateTextureIdOf(USER_ASSET)).toBeNull()
    expect(templateTextureIdOf(null)).toBeNull()
  })
})

describe('bindTemplateTextures', () => {
  it('points inline slots and texture properties at the stored assets', () => {
    const graph = graphWith(templateTexture('paper-grain'), templateTexture('paper-grain'))

    const bound = bindTemplateTextures(graph, new Map([['paper-grain', GRAIN_ASSET]]))

    expect(slotOf(bound)).toEqual(texture(GRAIN_ASSET))
    expect(bound.properties[0]?.value).toEqual(texture(GRAIN_ASSET))
  })

  it('leaves a texture that did not load as its reference, which reads as missing', () => {
    const graph = graphWith(templateTexture('paper-grain'), templateTexture('brush'))

    const bound = bindTemplateTextures(graph, new Map([['brush', GRAIN_ASSET]]))

    expect(slotOf(bound)).toEqual(templateTexture('paper-grain'))
    expect(bound.properties[0]?.value).toEqual(texture(GRAIN_ASSET))
  })

  it('keeps user assets, empty slots and every other value as they are', () => {
    const graph = graphWith(texture(USER_ASSET), texture(null))

    const bound = bindTemplateTextures(graph, new Map([['paper-grain', GRAIN_ASSET]]))

    expect(bound).toEqual(graph)
  })
})

describe('templateTexturesIn', () => {
  it('lists the template textures a graph reads, from slots and properties', () => {
    const graph = graphWith(templateTexture('paper-grain'), templateTexture('brush'))

    expect([...templateTexturesIn(graph)].sort()).toEqual(['brush', 'paper-grain'])
    expect(templateTexturesIn(graphWith(texture(USER_ASSET), texture(null))).size).toBe(0)
  })
})

describe('a template texture in the generated code', () => {
  it('becomes the same texture placeholder as an uploaded image', () => {
    const uploaded = generateModule(graphWith(texture(USER_ASSET), texture(null)), registry)
    const template = graphWith(templateTexture('paper-grain'), texture(null))
    const bound = bindTemplateTextures(template, new Map([['paper-grain', GRAIN_ASSET]]))

    expect(uploaded.errors).toEqual([])
    expect(uploaded.code).toContain('textures')
    expect(generateModule(bound, registry).code).toBe(uploaded.code)
    expect(generateModule(template, registry).code).toBe(uploaded.code)
  })
})
