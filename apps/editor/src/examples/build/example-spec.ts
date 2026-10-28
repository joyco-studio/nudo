import type { NodeTypeId, ParamValue, PortValue } from '@nudo-tsl/core'

/**
 * An example graph written as data: its properties, its nodes in commented groups and its wires.
 * `buildExampleGraph` turns it into a `Graph` with core operations and lays it out.
 */

type Values = Readonly<Record<string, PortValue>>
type Params = Readonly<Record<string, ParamValue>>

/** A node the graph builds with `addNode`, then fills with inline values and params. */
export interface PlainNodeSpec {
  readonly kind: 'node'
  readonly id: string
  readonly type: NodeTypeId
  readonly inputs: Values
  readonly params: Params
}

/** A reader of a Blackboard property, named by the property's reference name. */
export interface ReaderNodeSpec {
  readonly kind: 'reader'
  readonly id: string
  readonly property: string
}

export type NodeSpec = PlainNodeSpec | ReaderNodeSpec

/** The words of a comment frame. */
export interface CommentText {
  readonly title: string
  readonly body: string
}

/**
 * A step of the example: a comment frame titled `title`, its note `body`, around its nodes. The
 * graph stores the English words; `es` is what the frame says when the editor speaks Spanish.
 */
export interface GroupSpec extends CommentText {
  readonly id: string
  readonly es: CommentText
  readonly nodes: readonly NodeSpec[]
}

/** The id of the comment frame around a group. */
export const frameIdOf = (groupId: string): string => `frame-${groupId}`

export interface PropertySpec {
  /** The reference name; also the property id, so the JSON reads well. */
  readonly name: string
  readonly label: string
  readonly value: PortValue
  readonly widget?: 'color'
}

/** `node.port`, from an output to an input. */
export type PortPath = `${string}.${string}`
export type WireSpec = readonly [from: PortPath, to: PortPath]

export interface ExampleSpec {
  readonly properties: readonly PropertySpec[]
  readonly groups: readonly GroupSpec[]
  readonly wires: readonly WireSpec[]
  readonly master: { readonly inputs?: Values; readonly params?: Params }
}

export function node(id: string, type: NodeTypeId, inputs: Values = {}, params: Params = {}) {
  return { kind: 'node', id, type, inputs, params } as const satisfies PlainNodeSpec
}

export function reader(id: string, property: string) {
  return { kind: 'reader', id, property } as const satisfies ReaderNodeSpec
}
