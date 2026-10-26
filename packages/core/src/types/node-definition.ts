import type { DataType, PortTypeSpec } from './data-type'
import type { ParamValue } from './graph'
import type { NodeTypeId } from './ids'
import type { PortValue } from './port-value'
import type { TslFacade } from './tsl-facade'

export type NodeCategory =
  'input' | 'math' | 'interpolation' | 'vector' | 'effects' | 'texture' | 'utility' | 'master'

export type InputWidget = 'number' | 'color'

export interface InputDefinition<I extends string> {
  readonly id: I
  readonly label: string
  readonly type: PortTypeSpec
  readonly default: PortValue
  readonly widget?: InputWidget
  readonly optional?: boolean
}

export interface OutputDefinition<O extends string> {
  readonly id: O
  readonly label: string
  readonly type: PortTypeSpec
}

export interface BuildContext<E, I extends string> {
  readonly tsl: TslFacade<E>
  readonly inputs: Readonly<Record<I, E>>
  readonly resolvedTypes: Readonly<Record<I, DataType>>
  readonly params: Readonly<Record<string, ParamValue>>
}

export interface NodeDefinition<I extends string, O extends string> {
  readonly type: NodeTypeId
  readonly category: NodeCategory
  readonly label: string
  /** Tooltip text. */
  readonly description: string
  /** Add-node search keywords. */
  readonly keywords: readonly string[]
  readonly inputs: readonly InputDefinition<I>[]
  readonly outputs: readonly OutputDefinition<O>[]
  /** Written once, runs on both backends. */
  build<E>(ctx: BuildContext<E, I>): Readonly<Record<O, E>>
}

export type AnyNodeDefinition = NodeDefinition<string, string>
