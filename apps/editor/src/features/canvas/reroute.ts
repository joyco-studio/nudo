import type { DataType } from '@nudo-tsl/core'
import { rerouteNode } from '@nudo-tsl/nodes'

/**
 * The reroute's box, in flow units (Tailwind `w-10 h-6` in its view): its two ports sit on its
 * ends, a 24px target each, leaving the knot in the middle free to grab and drag.
 */
export const REROUTE_SIZE = { width: 40, height: 24 } as const

/** Whether a reroute can carry a value of this type: its input's generic group allows it. */
export function canReroute(dataType: DataType): boolean {
  const [input] = rerouteNode.inputs
  if (input === undefined) return false
  if (input.type.kind === 'concrete') return input.type.type === dataType
  return input.type.allowed.some((allowed) => allowed === dataType)
}
