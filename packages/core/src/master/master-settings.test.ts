import { describe, expect, it } from 'vitest'
import { addNode } from '../graph/add-node'
import { createGraph } from '../graph/create-graph'
import { connect } from '../graph/connect'
import { setInputValue } from '../graph/set-input-value'
import { setParam } from '../graph/set-param'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
import type { Graph } from '../types/graph'
import { MASTER_NODE_ID, MASTER_NODE_TYPE, asEdgeId, asNodeId } from '../types/ids'
import type { Result } from '../types/result'
import { concrete, float, vec3 } from '../values/port-value-factories'
import {
  isOpacityConnected,
  masterMaterialAssignments,
  readInlineOpacity,
  readMasterSettings,
  resolveTransparency,
  unlitColor,
} from './master-settings'

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const master = defineNode({
  type: MASTER_NODE_TYPE,
  category: 'master',
  label: 'Master',
  description: 'Master',
  keywords: [],
  inputs: [
    { id: 'baseColor', label: 'Base Color', type: concrete('vec3'), default: vec3(1, 1, 1) },
    { id: 'opacity', label: 'Opacity', type: concrete('float'), default: float(1) },
  ],
  outputs: [],
  params: [
    {
      id: 'lighting',
      label: 'Lighting',
      kind: 'enum',
      options: [
        { value: 'standard', label: 'Standard' },
        { value: 'unlit', label: 'Unlit' },
      ],
      default: 'standard',
    },
    {
      id: 'surface',
      label: 'Surface',
      kind: 'enum',
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'opaque', label: 'Opaque' },
        { value: 'transparent', label: 'Transparent' },
      ],
      default: 'auto',
    },
    { id: 'twoSided', label: 'Two sided', kind: 'boolean', default: false },
  ],
  build: () => ({}),
})

const source = defineNode({
  type: 'test/source',
  category: 'utility',
  label: 'Source',
  description: 'Source',
  keywords: [],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  build: ({ tsl }) => ({ out: tsl.construct('float', [0]) }),
})

const registry = createNodeRegistry()
registry.register(master)
registry.register(source)

const withParam = (graph: Graph, paramId: string, value: string | boolean): Graph =>
  unwrap(setParam(graph, registry, { nodeId: MASTER_NODE_ID, paramId }, value))

const tsl = { add: (a: string, b: string) => `add(${a},${b})` }

describe('readMasterSettings', () => {
  it('reads the stored params', () => {
    let graph = withParam(createGraph(), 'lighting', 'unlit')
    graph = withParam(graph, 'surface', 'transparent')
    graph = withParam(graph, 'twoSided', true)

    expect(readMasterSettings(graph, registry)).toEqual({
      lighting: 'unlit',
      surface: 'transparent',
      twoSided: true,
    })
  })

  it('defaults what is not stored', () => {
    expect(readMasterSettings(createGraph(), registry)).toEqual({
      lighting: 'standard',
      surface: 'auto',
      twoSided: false,
    })
  })

  it('ignores an unknown option and takes the default', () => {
    const graph = createGraph()
    const stored = graph.nodes[MASTER_NODE_ID]
    if (stored === undefined) throw new Error('A new graph has a master')
    const broken: Graph = {
      ...graph,
      nodes: {
        ...graph.nodes,
        [MASTER_NODE_ID]: { ...stored, params: { lighting: 'glossy', surface: 7 } },
      },
    }

    expect(readMasterSettings(broken, registry)).toEqual({
      lighting: 'standard',
      surface: 'auto',
      twoSided: false,
    })
  })
})

describe('transparency', () => {
  it('follows an explicit surface', () => {
    const input = { opacityConnected: true, inlineOpacity: 0.2 }

    expect(resolveTransparency({ ...input, surface: 'opaque' })).toBe(false)
    expect(resolveTransparency({ ...input, surface: 'transparent' })).toBe(true)
    expect(
      resolveTransparency({ surface: 'transparent', opacityConnected: false, inlineOpacity: 1 }),
    ).toBe(true)
  })

  it('blends an automatic surface when opacity is wired or inline below 1', () => {
    const auto = { surface: 'auto' } as const

    expect(resolveTransparency({ ...auto, opacityConnected: true, inlineOpacity: 1 })).toBe(true)
    expect(resolveTransparency({ ...auto, opacityConnected: false, inlineOpacity: 0.5 })).toBe(true)
    expect(resolveTransparency({ ...auto, opacityConnected: false, inlineOpacity: 1 })).toBe(false)
    expect(resolveTransparency({ ...auto, opacityConnected: false, inlineOpacity: null })).toBe(
      false,
    )
  })

  it('reads the inline opacity and whether opacity is wired', () => {
    const base = createGraph()
    const withValue = unwrap(
      setInputValue(base, { nodeId: MASTER_NODE_ID, portId: 'opacity' }, float(0.3)),
    )
    const withSource = unwrap(
      addNode(base, registry, { id: asNodeId('s'), type: 'test/source', position: { x: 0, y: 0 } }),
    )
    const wired = unwrap(
      connect(withSource, registry, {
        id: asEdgeId('e'),
        from: { nodeId: asNodeId('s'), portId: 'out' },
        to: { nodeId: MASTER_NODE_ID, portId: 'opacity' },
      }),
    )

    expect(readInlineOpacity(base, registry)).toBe(1)
    expect(readInlineOpacity(withValue, registry)).toBe(0.3)
    expect(isOpacityConnected(base)).toBe(false)
    expect(isOpacityConnected(wired)).toBe(true)
  })
})

describe('masterMaterialAssignments', () => {
  const slots = {
    position: 'p',
    baseColor: 'c',
    emission: 'e',
    metalness: 'm',
    roughness: 'r',
    normal: 'n',
    opacity: 'o',
    alphaClip: 'a',
  }

  it('maps every slot for a standard material, in slot order', () => {
    expect(masterMaterialAssignments(tsl, slots, 'standard')).toEqual([
      { property: 'positionNode', expression: 'p' },
      { property: 'colorNode', expression: 'c' },
      { property: 'emissiveNode', expression: 'e' },
      { property: 'metalnessNode', expression: 'm' },
      { property: 'roughnessNode', expression: 'r' },
      { property: 'normalNode', expression: 'n' },
      { property: 'opacityNode', expression: 'o' },
      { property: 'alphaTestNode', expression: 'a' },
    ])
  })

  it('skips slots that are not compiled', () => {
    expect(masterMaterialAssignments(tsl, { baseColor: 'c' }, 'standard')).toEqual([
      { property: 'colorNode', expression: 'c' },
    ])
  })

  it('reads only position, color, opacity and alpha clip for an unlit material', () => {
    expect(masterMaterialAssignments(tsl, slots, 'unlit')).toEqual([
      { property: 'positionNode', expression: 'p' },
      { property: 'colorNode', expression: 'add(c,e)' },
      { property: 'opacityNode', expression: 'o' },
      { property: 'alphaTestNode', expression: 'a' },
    ])
  })

  it('uses whichever of base color and emission exists for the unlit color', () => {
    expect(unlitColor(tsl, { baseColor: 'c' })).toBe('c')
    expect(unlitColor(tsl, { emission: 'e' })).toBe('e')
    expect(unlitColor(tsl, {})).toBeUndefined()
  })
})
