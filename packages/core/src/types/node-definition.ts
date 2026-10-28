import type { DataType, PortTypeSpec } from './data-type'
import type { ParamValue } from './graph'
import type { NodeTypeId } from './ids'
import type { ParamDefinition } from './param-definition'
import type { PortValue } from './port-value'
import type { BuiltinName, TslFacade } from './tsl-facade'

export type NodeCategory =
  | 'input'
  | 'math'
  | 'interpolation'
  | 'logic'
  | 'vector'
  | 'effects'
  | 'texture'
  | 'color'
  | 'scene'
  | 'normal'
  | 'utility'
  | 'master'

export type InputWidget = 'number' | 'color'

export interface InputDefinition<I extends string> {
  readonly id: I
  readonly label: string
  readonly type: PortTypeSpec
  readonly default: PortValue
  readonly widget?: InputWidget
  readonly optional?: boolean
  /**
   * Builtin the compiler uses while the input is unconnected, in place of an inline value: a mesh
   * default such as the UV or the view normal. Such an input has no uniform and no inline field.
   */
  readonly fallback?: BuiltinName
  /** What the input means, in one short sentence an artist reads in the port tooltip. */
  readonly description?: string
}

export interface OutputDefinition<O extends string> {
  readonly id: O
  readonly label: string
  readonly type: PortTypeSpec
  /** What the output carries, in one short sentence an artist reads in the port tooltip. */
  readonly description?: string
}

export interface BuildContext<E, I extends string> {
  readonly tsl: TslFacade<E>
  readonly inputs: Readonly<Record<I, E>>
  readonly resolvedTypes: Readonly<Record<I, DataType>>
  /** Node params with the definition's defaults filled in for params the node does not store. */
  readonly params: Readonly<Record<string, ParamValue>>
  /** The Blackboard property expression for `reads: 'property'` definitions; `null` otherwise. */
  readonly property: E | null
}

export interface NodeDefinition<I extends string, O extends string> {
  readonly type: NodeTypeId
  readonly category: NodeCategory
  readonly label: string
  /** Tooltip text. */
  readonly description: string
  /**
   * What the node computes, as a short display string under its title (`A × B`). Not code. Optional
   * so community nodes may leave it out.
   */
  readonly formula?: string
  /** Add-node search keywords. */
  readonly keywords: readonly string[]
  readonly inputs: readonly InputDefinition<I>[]
  readonly outputs: readonly OutputDefinition<O>[]
  /** Structural settings of the node. Universal params (collapsed, previewMode) are implicit. */
  readonly params?: readonly ParamDefinition[]
  /** Marks nodes that read a Blackboard property through the hidden string param `propertyId`. */
  readonly reads?: 'property'
  /** Written once, runs on both backends. */
  build<E>(ctx: BuildContext<E, I>): Readonly<Record<O, E>>
}

export type AnyNodeDefinition = NodeDefinition<string, string>
