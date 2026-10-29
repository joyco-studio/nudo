import type { BlackboardProperty } from '../types/blackboard-property'
import type { GraphNode, PortRef } from '../types/graph'
import type { NodeId } from '../types/ids'
import type { AnyNodeDefinition, InputWidget } from '../types/node-definition'
import type { PortValue } from '../types/port-value'
import type { TslFacade } from '../types/tsl-facade'

/** A master slot the surface material reads. */
export type SurfaceSlot =
  | 'position'
  | 'baseColor'
  | 'emission'
  | 'metalness'
  | 'roughness'
  | 'normal'
  | 'opacity'
  | 'alphaClip'
  | 'transmission'
  | 'ior'
  | 'thickness'
  | 'clearcoat'
  | 'clearcoatRoughness'
  | 'sheen'
  | 'sheenRoughness'
  | 'iridescence'
  | 'iridescenceIOR'

/** A master slot only the outline pass reads. */
export type OutlineSlot = 'outlineWidth' | 'outlineColor'

export type MasterSlot = SurfaceSlot | OutlineSlot

export const SURFACE_SLOTS: readonly SurfaceSlot[] = [
  'position',
  'baseColor',
  'emission',
  'metalness',
  'roughness',
  'normal',
  'opacity',
  'alphaClip',
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

export const OUTLINE_SLOTS: readonly OutlineSlot[] = ['outlineWidth', 'outlineColor']

/** Every slot the master compiles, in input order. */
export const MASTER_SLOTS: readonly MasterSlot[] = [...SURFACE_SLOTS, ...OUTLINE_SLOTS]

/** What a compilation targets the graph with: a concrete expression type `E` per backend. */
export interface CompileBackend<E> {
  readonly tsl: TslFacade<E>
  /** Expression for an unconnected input; the live backend turns it into a `uniform()`. */
  inputValue(ref: PortRef, value: PortValue, widget: InputWidget | undefined): E
  /** Expression for a Blackboard property; called once per property per compilation. */
  property(property: BlackboardProperty): E
  /**
   * Called once per evaluated node output, after `build`; the returned expression replaces the
   * output downstream. Codegen hoists shared values into named constants through this hook.
   */
  nameOutput?(node: GraphNode, definition: AnyNodeDefinition, portId: string, expression: E): E
}

export type CompileTarget = { kind: 'master' } | { kind: 'port'; ref: PortRef }

export interface CompileError {
  readonly nodeId: NodeId
  readonly code: 'missing-definition' | 'unresolved-type' | 'build-failed' | 'missing-property'
  readonly message: string
}

export type CompileOutput<E> =
  { kind: 'master'; slots: Partial<Record<MasterSlot, E>> } | { kind: 'port'; expression: E }

export type CompileResult<E> =
  { ok: true; output: CompileOutput<E> } | { ok: false; errors: readonly CompileError[] }
