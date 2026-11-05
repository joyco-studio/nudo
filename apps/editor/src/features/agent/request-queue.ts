import { TOOL_CATALOG } from '@nudo-tsl/agent-protocol'
import type {
  AgentError,
  BridgeRequest,
  BridgeResponse,
  ToolName,
  ToolSpec,
} from '@nudo-tsl/agent-protocol'
import { err } from '@nudo-tsl/core'
import { withDisplayName } from './agent-brand'
import type { ToolGate } from './task-machine'
import type { ToolContext, ToolHandler } from './tool-context'

const SPECS_BY_NAME: ReadonlyMap<string, ToolSpec> = new Map(
  TOOL_CATALOG.map((spec) => [spec.name, spec]),
)

const failure = (id: string, error: AgentError): BridgeResponse => ({
  kind: 'response',
  id,
  ok: false,
  error,
})

const invalid = (id: string, message: string, state?: unknown): BridgeResponse =>
  failure(
    id,
    state === undefined ? { code: 'invalid', message } : { code: 'invalid', message, state },
  )

const describeThrown = (thrown: unknown): string =>
  thrown instanceof Error ? thrown.message : 'The tool failed unexpectedly.'

/**
 * The tab gives up this much before the room does, so the latency of the request's trip never
 * lets the tab apply a call the room already answered with `timeout`.
 */
export const DEADLINE_MARGIN_MS = 500

const timedOut = (timeoutMs: number): AgentError => ({
  code: 'timeout',
  message: `The request was not applied: it waited longer than its ${String(timeoutMs)} ms timeout.`,
})

/**
 * Aborts when the request's time is up. The signal declines an open confirmation, and the context
 * it guards refuses writes after it, so a handler that outlives its request changes nothing.
 */
function withDeadline(
  context: Omit<ToolContext, 'agent'>,
  signal: AbortSignal,
  timeoutMs: number,
): Omit<ToolContext, 'agent'> {
  return {
    ...context,
    canWrite: (agent) => (signal.aborted ? err(timedOut(timeoutMs)) : context.canWrite(agent)),
    confirm: (kind) => context.confirm(kind, signal),
  }
}

async function execute(
  request: IncomingRequest,
  handlers: Partial<Record<ToolName, ToolHandler>>,
  context: Omit<ToolContext, 'agent'>,
  gate: ToolGate,
  signal: AbortSignal,
): Promise<BridgeResponse> {
  const spec = SPECS_BY_NAME.get(request.tool)
  if (spec === undefined) return invalid(request.id, `Unknown tool "${request.tool}".`)
  // It waited in line past its time: the agent was already told it timed out.
  if (signal.aborted) return failure(request.id, timedOut(request.timeoutMs))

  try {
    const parsed = spec.args.safeParse(request.args)
    if (!parsed.success) {
      return invalid(request.id, `Invalid arguments for ${request.tool}.`, parsed.error.issues)
    }

    const handler = handlers[spec.name]
    if (handler === undefined) {
      return invalid(request.id, `Tool "${request.tool}" is not available.`)
    }

    // The agent goes by its product name ("Cursor", not `cursor-vscode`) everywhere it shows.
    const agent = withDisplayName(request.agent)
    // Stop, busy and implicit tasks are decided here, before the handler can touch the graph.
    const admitted = gate.admit(spec.name, agent)
    if (!admitted.ok) return failure(request.id, admitted.error)

    try {
      const result = await handler(parsed.data, {
        ...withDeadline(context, signal, request.timeoutMs),
        agent,
      })
      if (!result.ok) return failure(request.id, result.error)
      return { kind: 'response', id: request.id, ok: true, result: result.value }
    } finally {
      gate.settle(agent)
    }
  } catch (thrown) {
    return invalid(request.id, describeThrown(thrown))
  }
}

/** A request whose tool name is not yet known to be in the catalog. */
export type IncomingRequest = Omit<BridgeRequest, 'tool'> & { tool: string }

/** Aborts `DEADLINE_MARGIN_MS` before the room's timeout, counted from the request's arrival. */
function deadlineSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(
    () => {
      controller.abort()
    },
    Math.max(0, timeoutMs - DEADLINE_MARGIN_MS),
  )
  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer)
    },
  }
}

/**
 * Runs bridge requests one at a time, in arrival order, validating args against the catalog.
 * `gate` (the task machine's) admits every call before its handler, and can refuse it, and is told
 * when the handler settles. A request whose timeout runs out (counted from its arrival) is dropped
 * with `timeout` if it has not started, and its confirmation and later writes are refused if it
 * has.
 */
export function createRequestQueue(
  handlers: Partial<Record<ToolName, ToolHandler>>,
  context: Omit<ToolContext, 'agent'>,
  gate: ToolGate,
): (request: IncomingRequest) => Promise<BridgeResponse> {
  let tail: Promise<unknown> = Promise.resolve()
  return (request) => {
    const deadline = deadlineSignal(request.timeoutMs)
    const response = tail
      .then(() => execute(request, handlers, context, gate, deadline.signal))
      .finally(deadline.clear)
    tail = response
    return response
  }
}
