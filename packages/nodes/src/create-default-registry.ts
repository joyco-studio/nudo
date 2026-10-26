import { createNodeRegistry } from '@nudo-tsl/core'
import type { AnyNodeDefinition, NodeRegistry } from '@nudo-tsl/core'
import { checkerboardNode } from './effects/checkerboard-node'
import { fresnelNode } from './effects/fresnel-node'
import { gradientNode } from './effects/gradient-node'
import { noiseNode } from './effects/noise-node'
import { voronoiNode } from './effects/voronoi-node'
import { colorSpaceNode } from './color/color-space-node'
import { cameraPositionNode } from './input/camera-position-node'
import { colorNode } from './input/color-node'
import { floatNode } from './input/float-node'
import { normalNode } from './input/normal-node'
import { positionNode } from './input/position-node'
import { screenUvNode } from './input/screen-uv-node'
import { timeNode } from './input/time-node'
import { uvNode } from './input/uv-node'
import { vector2Node, vector3Node, vector4Node } from './input/vector-input-nodes'
import { viewDirectionNode } from './input/view-direction-node'
import { aaStepNode } from './interpolation/aa-step-node'
import { lerpNode } from './interpolation/lerp-node'
import { smoothstepNode } from './interpolation/smoothstep-node'
import { stepNode } from './interpolation/step-node'
import { selectNode } from './logic/select-node'
import { masterStackNode } from './master/master-stack'
import { absNode } from './math/abs-node'
import { addMathNode } from './math/add-node'
import { clampNode } from './math/clamp-node'
import { cosNode } from './math/cos-node'
import { distanceNode } from './math/distance-node'
import { divideNode } from './math/divide-node'
import { expNode } from './math/exp-node'
import { floorNode } from './math/floor-node'
import { fractNode } from './math/fract-node'
import { maxNode } from './math/max-node'
import { minNode } from './math/min-node'
import { multiplyNode } from './math/multiply-node'
import { oneMinusNode } from './math/one-minus-node'
import { powerNode } from './math/power-node'
import { remapNode } from './math/remap-node'
import { sinNode } from './math/sin-node'
import { subtractNode } from './math/subtract-node'
import { normalFromHeightNode } from './normal/normal-from-height-node'
import {
  floatPropertyNode,
  texturePropertyNode,
  vec2PropertyNode,
  vec3PropertyNode,
  vec4PropertyNode,
} from './property/property-nodes'
import { depthFadeNode } from './scene/depth-fade-node'
import { sceneColorNode } from './scene/scene-color-node'
import { sampleTexture2dNode } from './texture/sample-texture-2d-node'
import { commentNode } from './utility/comment-node'
import { combineNode } from './vector/combine-node'
import { dotNode } from './vector/dot-node'
import { lengthNode } from './vector/length-node'
import { normalizeNode } from './vector/normalize-node'
import { rotate2dNode } from './vector/rotate-2d-node'
import { splitNode } from './vector/split-node'

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

/** Math, interpolation, logic and vector nodes. */
export const PHASE_2_CATALOG_A: readonly AnyNodeDefinition[] = [
  subtractNode,
  divideNode,
  powerNode,
  cosNode,
  absNode,
  fractNode,
  floorNode,
  oneMinusNode,
  expNode,
  minNode,
  maxNode,
  clampNode,
  remapNode,
  distanceNode,
  stepNode,
  smoothstepNode,
  aaStepNode,
  selectNode,
  splitNode,
  combineNode,
  dotNode,
  lengthNode,
  normalizeNode,
  rotate2dNode,
]

/** Inputs, properties, effects, texture, color, scene, normal and utility nodes. */
export const PHASE_2_CATALOG_B: readonly AnyNodeDefinition[] = [
  vector2Node,
  vector3Node,
  vector4Node,
  positionNode,
  viewDirectionNode,
  screenUvNode,
  cameraPositionNode,
  floatPropertyNode,
  vec2PropertyNode,
  vec3PropertyNode,
  vec4PropertyNode,
  texturePropertyNode,
  noiseNode,
  voronoiNode,
  checkerboardNode,
  gradientNode,
  sampleTexture2dNode,
  colorSpaceNode,
  sceneColorNode,
  depthFadeNode,
  normalFromHeightNode,
  commentNode,
]

export function createDefaultRegistry(): NodeRegistry {
  const registry = createNodeRegistry()
  for (const definition of [...PHASE_1_DEFINITIONS, ...PHASE_2_CATALOG_A, ...PHASE_2_CATALOG_B]) {
    const result = registry.register(definition)
    if (!result.ok) throw new Error(`Duplicate built-in node type: ${result.error.type}`)
  }
  return registry
}
