import { parseToolArgs } from '@nudo-tsl/agent-protocol'
import type { AgentError, ToolArgs, ToolName } from '@nudo-tsl/agent-protocol'
import { err } from '@nudo-tsl/core'
import type { Result } from '@nudo-tsl/core'
import type { ToolContext, ToolHandler } from './tool-context'

/**
 * Builds a handler whose `args` are typed by the catalog schema of `name`. The queue has already
 * validated the request; parsing again here is what gives `run` its type without a cast.
 */
export function defineHandler<N extends ToolName>(
  name: N,
  run: (args: ToolArgs<N>, context: ToolContext) => Promise<Result<unknown, AgentError>>,
): ToolHandler {
  return (args, context) => {
    const parsed = parseToolArgs(name, args)
    if (!parsed.success) {
      return Promise.resolve(
        err({
          code: 'invalid',
          message: `Invalid arguments for ${name}.`,
          state: parsed.error.issues,
        }),
      )
    }
    return run(parsed.data, context)
  }
}
