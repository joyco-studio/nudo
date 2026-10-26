import type { PortRef } from '../types/graph'
import type { NodeId } from '../types/ids'
import type { InputWidget } from '../types/node-definition'
import type { PortValue } from '../types/port-value'
import type { TslFacade } from '../types/tsl-facade'

export type MasterSlot =
  'position' | 'baseColor' | 'emission' | 'metalness' | 'roughness' | 'normal' | 'opacity'

export const MASTER_SLOTS: readonly MasterSlot[] = [
  'position',
  'baseColor',
  'emission',
  'metalness',
  'roughness',
  'normal',
  'opacity',
]

/** What a compilation targets the graph with: a concrete expression type `E` per backend. */
export interface CompileBackend<E> {
  readonly tsl: TslFacade<E>
  /** Expression for an unconnected input; the live backend turns it into a `uniform()`. */
  inputValue(ref: PortRef, value: PortValue, widget: InputWidget | undefined): E
}

export type CompileTarget = { kind: 'master' } | { kind: 'port'; ref: PortRef }

export interface CompileError {
  readonly nodeId: NodeId
  readonly code: 'missing-definition' | 'unresolved-type' | 'build-failed'
  readonly message: string
}

export type CompileOutput<E> =
  { kind: 'master'; slots: Partial<Record<MasterSlot, E>> } | { kind: 'port'; expression: E }

export type CompileResult<E> =
  { ok: true; output: CompileOutput<E> } | { ok: false; errors: readonly CompileError[] }
