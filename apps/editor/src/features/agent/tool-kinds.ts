import type { ToolName } from '@nudo-tsl/agent-protocol'

/** Tools that change the graph. Only these are gated by Stop and busy, and open implicit tasks. */
export const WRITE_TOOL_NAMES = [
  'add_node',
  'remove_nodes',
  'move_nodes',
  'connect',
  'disconnect',
  'set_input',
  'set_param',
  'add_property',
  'set_property',
  'remove_property',
  'tidy_up',
  'new_graph',
  'load_template',
] as const satisfies readonly ToolName[]

export type WriteToolName = (typeof WRITE_TOOL_NAMES)[number]

export const TASK_TOOL_NAMES = [
  'start_task',
  'set_step',
  'finish_task',
] as const satisfies readonly ToolName[]

export type TaskToolName = (typeof TASK_TOOL_NAMES)[number]

const WRITE_TOOLS: ReadonlySet<ToolName> = new Set(WRITE_TOOL_NAMES)

export const isWriteTool = (tool: ToolName): boolean => WRITE_TOOLS.has(tool)
