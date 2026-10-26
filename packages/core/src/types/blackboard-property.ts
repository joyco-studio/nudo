import type { PropertyId } from './ids'
import type { PortValue } from './port-value'

export type PropertyType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'texture'

/** A named value shared across the graph (the Blackboard). */
export interface BlackboardProperty {
  readonly id: PropertyId
  /** Free display text. */
  readonly label: string
  /** JS identifier: the uniform / reference name. */
  readonly name: string
  /** When false, codegen inlines the value as a constant instead of a live uniform. */
  readonly exposed: boolean
  readonly type: PropertyType
  readonly widget?: 'color'
  readonly value: PortValue
}
