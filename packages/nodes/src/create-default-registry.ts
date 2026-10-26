import { createNodeRegistry } from '@nudo-tsl/core'
import type { AnyNodeDefinition, NodeRegistry } from '@nudo-tsl/core'
import { fresnelNode } from './effects/fresnel-node'
import { colorNode } from './input/color-node'
import { floatNode } from './input/float-node'
import { normalNode } from './input/normal-node'
import { timeNode } from './input/time-node'
import { uvNode } from './input/uv-node'
import { lerpNode } from './interpolation/lerp-node'
import { masterStackNode } from './master/master-stack'
import { addMathNode } from './math/add-node'
import { multiplyNode } from './math/multiply-node'
import { sinNode } from './math/sin-node'

const PHASE_1_DEFINITIONS: readonly AnyNodeDefinition[] = [
  masterStackNode,
  floatNode,
  colorNode,
  timeNode,
  uvNode,
  normalNode,
  addMathNode,
  multiplyNode,
  sinNode,
  lerpNode,
  fresnelNode,
]

export function createDefaultRegistry(): NodeRegistry {
  const registry = createNodeRegistry()
  for (const definition of PHASE_1_DEFINITIONS) {
    const result = registry.register(definition)
    if (!result.ok) throw new Error(`Duplicate built-in node type: ${result.error.type}`)
  }
  return registry
}
