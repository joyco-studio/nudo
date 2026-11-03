import type { AgentError, AgentIdentity } from '@nudo-tsl/agent-protocol'
import type { NodeId, Result } from '@nudo-tsl/core'
import type { Choreograph } from './choreography'

export type ConfirmKind = 'new_graph' | 'load_template'

export interface NodeTouch {
  nodeId: NodeId
  created: boolean
}

export interface ToolContext {
  agent: AgentIdentity
  choreograph: Choreograph
  onTouch(touch: NodeTouch): void
  /** The node the agent created or edited last in this task, if any. */
  lastTouched(): NodeId | null
  tidyUp(): Promise<void>
  confirm(kind: ConfirmKind): Promise<boolean>
}

export type ToolHandler = (
  args: unknown,
  context: ToolContext,
) => Promise<Result<unknown, AgentError>>
