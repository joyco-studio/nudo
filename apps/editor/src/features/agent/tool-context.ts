import type { AgentError, AgentIdentity } from '@nudo-tsl/agent-protocol'
import type { NodeId, Result } from '@nudo-tsl/core'
import type { Choreograph } from './choreography'

export type ConfirmKind = 'new_graph' | 'load_template'

export interface NodeTouch {
  nodeId: NodeId
  created: boolean
}

/**
 * Runs one agent store write unless the agent may no longer write (stopped or busy), marking it as
 * the agent's for Undo all. Resolves whether the write ran.
 */
export type CommitWrite = (write: () => void) => boolean

export interface ToolContext {
  agent: AgentIdentity
  choreograph: Choreograph
  /** Whether `agent` may write right now; re-checked just before every commit that follows an await. */
  canWrite(agent: AgentIdentity): Result<void, AgentError>
  onTouch(touch: NodeTouch): void
  /** The node the agent created or edited last in this task, if any. */
  lastTouched(): NodeId | null
  /** Implementations must commit the layout through `commit` (it runs inside `markAgentWrite`). */
  tidyUp(commit: CommitWrite): Promise<void>
  confirm(kind: ConfirmKind): Promise<boolean>
}

export type ToolHandler = (
  args: unknown,
  context: ToolContext,
) => Promise<Result<unknown, AgentError>>
