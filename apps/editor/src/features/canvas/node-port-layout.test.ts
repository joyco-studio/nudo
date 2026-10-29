import { MASTER_NODE_ID, asNodeId } from '@nudo-tsl/core'
import type { GraphNode } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { registry } from '@/store/registry'

import { groupInputs, inputGroups, shownRows, visibleOutputs } from './node-port-layout'
import type { DisabledHint } from './node-port-layout'
import type { FlowNodeData } from './to-flow'

function dataFor(
  node: GraphNode,
  connected: { inputs?: readonly string[]; outputs?: readonly string[] } = {},
): FlowNodeData {
  const definition = registry.get(node.type)
  if (definition === undefined) throw new Error(`Missing ${node.type}`)
  return {
    definition,
    node,
    title: definition.label,
    typeChip: null,
    inputTypes: {},
    outputTypes: {},
    connectedInputs: new Set(connected.inputs ?? []),
    connectedOutputs: new Set(connected.outputs ?? []),
    inputSources: {},
    error: undefined,
  }
}

const sine = (params: GraphNode['params'] = {}): GraphNode => ({
  id: asNodeId('sine'),
  type: 'math/sin',
  position: { x: 0, y: 0 },
  inputValues: {},
  params,
})

const colorRamp = (params: GraphNode['params'] = {}): GraphNode => ({
  id: asNodeId('ramp'),
  type: 'color/color-ramp',
  position: { x: 0, y: 0 },
  inputValues: {},
  params,
})

const master = (params: GraphNode['params'] = {}): GraphNode => ({
  id: MASTER_NODE_ID,
  type: 'master/stack',
  position: { x: 0, y: 0 },
  inputValues: {},
  params,
})

const PHYSICAL_INPUT_IDS: readonly string[] = [
  'transmission',
  'ior',
  'thickness',
  'clearcoat',
  'clearcoatRoughness',
  'sheen',
  'sheenRoughness',
  'iridescence',
  'iridescenceIOR',
]

function registryInputs() {
  const definition = registry.get('master/stack')
  if (definition === undefined) throw new Error('Missing master/stack')
  return definition.inputs
}

/** Each master input's disabled hint, by input id, under the given params. */
function hintsOf(params: GraphNode['params']): ReadonlyMap<string, DisabledHint | null> {
  const rows = groupInputs(master(params), registryInputs()).flatMap((group) => group.rows)
  return new Map(rows.map((row) => [row.input.id, row.disabledHint]))
}

const inputIds = (data: FlowNodeData) =>
  inputGroups(data).flatMap((group) => group.rows.map((row) => row.input.id))

describe('node port layout', () => {
  it('shows every port of an expanded node', () => {
    const data = dataFor(sine())
    expect(inputIds(data)).toEqual(['in'])
    expect(visibleOutputs(data).map((output) => output.id)).toEqual(['out'])
  })

  it('shows only connected ports of a collapsed node', () => {
    const data = dataFor(sine({ collapsed: true }), { inputs: ['in'] })
    expect(inputIds(data)).toEqual(['in'])
    expect(visibleOutputs(data)).toEqual([])
  })

  it('leaves out the inputs a node hides for its params', () => {
    expect(inputIds(dataFor(colorRamp()))).toEqual([
      'in',
      'stop0Position',
      'stop0Color',
      'stop1Position',
      'stop1Color',
    ])
    expect(inputIds(dataFor(colorRamp({ count: 3 })))).toContain('stop2Color')
    expect(inputIds(dataFor(colorRamp({ count: 3 })))).not.toContain('stop3Position')
    expect(inputIds(dataFor(colorRamp({ count: 8 })))).toHaveLength(17)
  })

  it('leaves the inputs a node hides for its params out of every group it builds', () => {
    const ramp = colorRamp()
    const definition = registry.get(ramp.type)
    if (definition === undefined) throw new Error('No Color Ramp definition')
    const rows = groupInputs(ramp, definition.inputs).flatMap((group) => group.rows)
    expect(rows.map((row) => row.input.id)).not.toContain('stop2Position')
  })

  it('groups the master inputs into Vertex, Fragment and Physical', () => {
    const groups = inputGroups(dataFor(master()))
    expect(groups.map((group) => group.title)).toEqual([
      'node.group.vertex',
      'node.group.fragment',
      'node.group.physical',
    ])
    expect(groups[0]?.rows.map((row) => row.input.id)).toEqual(['position'])
    expect(groups[2]?.rows.map((row) => row.input.id)).toEqual(PHYSICAL_INPUT_IDS)
    expect(groups[1]?.rows.some((row) => PHYSICAL_INPUT_IDS.includes(row.input.id))).toBe(false)
  })

  it('folds the Physical group away unless the lighting is physical', () => {
    const physicalGroup = (lighting: string) =>
      inputGroups(dataFor(master({ lighting }))).find(
        (group) => group.title === 'node.group.physical',
      )
    expect(physicalGroup('standard')?.disclosure).toEqual({ isOpenByDefault: false })
    expect(physicalGroup('unlit')?.disclosure).toEqual({ isOpenByDefault: false })
    expect(physicalGroup('physical')?.disclosure).toEqual({ isOpenByDefault: true })
    const [vertex, fragment] = inputGroups(dataFor(master()))
    expect(vertex?.disclosure).toBeNull()
    expect(fragment?.disclosure).toBeNull()
  })

  it('has no Physical fold on a collapsed master, which already shows only connected ports', () => {
    const groups = inputGroups(dataFor(master({ collapsed: true }), { inputs: ['clearcoat'] }))
    const physical = groups.find((group) => group.title === 'node.group.physical')
    expect(physical?.rows.map((row) => row.input.id)).toEqual(['clearcoat'])
    expect(physical?.disclosure).toBeNull()
  })

  it('shows only the connected rows of a closed group, and every row of an open one', () => {
    const physical = groupInputs(master(), registryInputs()).find(
      (group) => group.title === 'node.group.physical',
    )
    if (physical === undefined) throw new Error('No Physical group')
    const connected = new Set(['sheen'])
    expect(shownRows(physical, false, connected).map((row) => row.input.id)).toEqual(['sheen'])
    expect(shownRows(physical, true, connected)).toHaveLength(PHYSICAL_INPUT_IDS.length)
    const [vertex] = groupInputs(master(), registryInputs())
    if (vertex === undefined) throw new Error('No Vertex group')
    expect(shownRows(vertex, false, new Set())).toEqual(vertex.rows)
  })

  it('marks metalness, roughness and normal as ignored by an unlit master', () => {
    const hints = hintsOf({ lighting: 'unlit' })
    const unlit = [...hints].filter(([, hint]) => hint?.reason === 'unlit')
    expect(unlit.map(([id]) => id)).toEqual(['metalness', 'roughness', 'normal'])
  })

  it('marks the physical inputs as physical only unless the lighting is physical', () => {
    for (const lighting of ['standard', 'unlit']) {
      const hints = hintsOf({ lighting, useClearcoat: true })
      for (const id of PHYSICAL_INPUT_IDS) expect(hints.get(id)).toEqual({ reason: 'physicalOnly' })
    }
    const standard = hintsOf({})
    const surfaceIds = [...standard.keys()].filter((id) => !PHYSICAL_INPUT_IDS.includes(id))
    expect(surfaceIds.every((id) => standard.get(id) === null)).toBe(true)
  })

  it('asks for the feature switch while a physical feature is off', () => {
    const hints = hintsOf({ lighting: 'physical', useClearcoat: true })
    expect(hints.get('clearcoat')).toBeNull()
    expect(hints.get('clearcoatRoughness')).toBeNull()
    expect(hints.get('transmission')).toEqual({ reason: 'featureOff', feature: 'transmission' })
    expect(hints.get('ior')).toEqual({ reason: 'featureOff', feature: 'transmission' })
    expect(hints.get('thickness')).toEqual({ reason: 'featureOff', feature: 'transmission' })
    expect(hints.get('sheen')).toEqual({ reason: 'featureOff', feature: 'sheen' })
    expect(hints.get('sheenRoughness')).toEqual({ reason: 'featureOff', feature: 'sheen' })
    expect(hints.get('iridescence')).toEqual({ reason: 'featureOff', feature: 'iridescence' })
    expect(hints.get('iridescenceIOR')).toEqual({ reason: 'featureOff', feature: 'iridescence' })
    expect(hints.get('roughness')).toBeNull()
  })

  it('leaves every physical input enabled once every feature is on', () => {
    const hints = hintsOf({
      lighting: 'physical',
      useTransmission: true,
      useClearcoat: true,
      useSheen: true,
      useIridescence: true,
    })
    expect([...hints.values()].every((hint) => hint === null)).toBe(true)
  })
})
