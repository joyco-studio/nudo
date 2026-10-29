import type { GraphNode, NodeRegistry, PortValue } from '@nudo-tsl/core'
import {
  COLOR_RAMP_MAX_STOPS,
  COLOR_RAMP_MIN_STOPS,
  colorRampCount,
  colorRampNode,
  colorRampStopInputIds,
} from '@nudo-tsl/nodes'

import type { Rgb } from '@/shared/components/color-picker/color-math'

export const COLOR_RAMP_TYPE = colorRampNode.type
export { COLOR_RAMP_MAX_STOPS, COLOR_RAMP_MIN_STOPS }

/** A stop as the ramp reads it: where it sits (0..1) and its linear RGB color. */
export interface ColorRampStop {
  readonly position: number
  readonly color: Rgb
}

export type ColorRampInterpolation = 'linear' | 'constant' | 'smooth'

const INTERPOLATIONS: readonly ColorRampInterpolation[] = ['linear', 'constant', 'smooth']
const DEFAULT_INTERPOLATION: ColorRampInterpolation = 'linear'

/** Mirrors the node build: keeps the division finite when two stops share a position. */
const DIVISION_GUARD = 0.00001
const SMOOTH_COEFFICIENT_A = 3
const SMOOTH_COEFFICIENT_B = 2

export type StopPart = 'position' | 'color'

export interface StopPort {
  readonly index: number
  readonly part: StopPart
}

const STOP_PORTS: ReadonlyMap<string, StopPort> = new Map(
  Array.from({ length: COLOR_RAMP_MAX_STOPS }, (_, index) => {
    const ids = colorRampStopInputIds(index)
    const position: [string, StopPort] = [ids.position, { index, part: 'position' }]
    const color: [string, StopPort] = [ids.color, { index, part: 'color' }]
    return [position, color]
  }).flat(),
)

export const isColorRamp = (node: GraphNode): boolean => node.type === COLOR_RAMP_TYPE

/** Which stop an input of a Color Ramp belongs to, or null for any other input. */
export function stopPortOf(inputId: string): StopPort | null {
  return STOP_PORTS.get(inputId) ?? null
}

/** A Color Ramp stop input: its value is edited by the ramp editor, not by an inline field. */
export function isColorRampStopInput(node: GraphNode, inputId: string): boolean {
  return isColorRamp(node) && stopPortOf(inputId) !== null
}

export function colorRampInterpolation(node: GraphNode): ColorRampInterpolation {
  const stored = node.params.interpolation
  return INTERPOLATIONS.find((option) => option === stored) ?? DEFAULT_INTERPOLATION
}

function storedOrDefault(
  node: GraphNode,
  registry: NodeRegistry,
  inputId: string,
): PortValue | undefined {
  const stored = node.inputValues[inputId]
  if (stored !== undefined) return stored
  return registry.get(node.type)?.inputs.find((input) => input.id === inputId)?.default
}

function readPosition(node: GraphNode, registry: NodeRegistry, inputId: string): number {
  const value = storedOrDefault(node, registry, inputId)
  return value?.type === 'float' ? value.value : 0
}

function readColor(node: GraphNode, registry: NodeRegistry, inputId: string): Rgb {
  const value = storedOrDefault(node, registry, inputId)
  return value?.type === 'vec3' ? value.value : [0, 0, 0]
}

/** The stops in play (the first `count`), with their stored values or the input defaults. */
export function readColorRampStops(
  node: GraphNode,
  registry: NodeRegistry,
): readonly ColorRampStop[] {
  return Array.from({ length: colorRampCount(node.params) }, (_, index) => {
    const ids = colorRampStopInputIds(index)
    return {
      position: readPosition(node, registry, ids.position),
      color: readColor(node, registry, ids.color),
    }
  })
}

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value))

const mixRgb = (from: Rgb, to: Rgb, weight: number): Rgb => [
  from[0] + (to[0] - from[0]) * weight,
  from[1] + (to[1] - from[1]) * weight,
  from[2] + (to[2] - from[2]) * weight,
]

function segmentWeight(
  interpolation: ColorRampInterpolation,
  value: number,
  from: ColorRampStop,
  to: ColorRampStop,
): number {
  if (interpolation === 'constant') return value >= to.position ? 1 : 0
  const span = Math.max(to.position - from.position, DIVISION_GUARD)
  const progress = clampUnit((value - from.position) / span)
  if (interpolation === 'linear') return progress
  return progress * progress * (SMOOTH_COEFFICIENT_A - SMOOTH_COEFFICIENT_B * progress)
}

/** The linear color the ramp gives at `value`, computed the way the node's shader does. */
export function colorRampColorAt(
  stops: readonly ColorRampStop[],
  interpolation: ColorRampInterpolation,
  value: number,
): Rgb {
  const [first, ...rest] = stops
  if (first === undefined) return [0, 0, 0]
  let color = first.color
  let previous = first
  for (const stop of rest) {
    color = mixRgb(color, stop.color, segmentWeight(interpolation, value, previous, stop))
    previous = stop
  }
  return color
}
