import { MASTER_NODE_ID } from '@nudo-tsl/core'
import type { GraphNode } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { registry } from '@/store/registry'

import { estimateGeometry } from './node-geometry'

/** The figures `estimateGeometry` adds per row and per Master Stack heading. */
const ROW_HEIGHT = 28
const GROUP_HEADING_HEIGHT = 24
const PHYSICAL_INPUT_COUNT = 10
const PHYSICAL_SWITCH_COUNT = 4

const PHYSICAL_INPUT_IDS: readonly string[] = [
  'specularIntensity',
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

function masterGeometry(lighting: string) {
  const definition = registry.get('master/stack')
  if (definition === undefined) throw new Error('Missing master/stack')
  const node: GraphNode = {
    id: MASTER_NODE_ID,
    type: 'master/stack',
    position: { x: 0, y: 0 },
    inputValues: {},
    params: { lighting },
  }
  return estimateGeometry(node, definition, node.position)
}

describe('the master height estimate', () => {
  it('counts only the folded Physical heading while the lighting is not physical', () => {
    for (const lighting of ['standard', 'unlit']) {
      const { inputY } = masterGeometry(lighting)
      expect(Object.keys(inputY).filter((id) => PHYSICAL_INPUT_IDS.includes(id))).toEqual([])
    }
    expect(masterGeometry('unlit').height).toBe(masterGeometry('standard').height)
  })

  it('counts the ten physical inputs and the four switches of a physical master', () => {
    const standard = masterGeometry('standard')
    const physical = masterGeometry('physical')
    expect(Object.keys(physical.inputY).filter((id) => PHYSICAL_INPUT_IDS.includes(id))).toEqual(
      PHYSICAL_INPUT_IDS,
    )
    expect(physical.height - standard.height).toBe(
      (PHYSICAL_INPUT_COUNT + PHYSICAL_SWITCH_COUNT) * ROW_HEIGHT,
    )
  })

  it('places the Physical rows under their heading, after the last fragment row', () => {
    const { inputY } = masterGeometry('physical')
    const lastFragment = inputY.alphaClip
    const firstPhysical = inputY.specularIntensity
    if (lastFragment === undefined || firstPhysical === undefined) throw new Error('Missing rows')
    expect(firstPhysical - lastFragment).toBe(ROW_HEIGHT + GROUP_HEADING_HEIGHT)
  })
})
