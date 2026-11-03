import { TOOL_CATALOG } from '@nudo-tsl/agent-protocol'
import type {
  AgentError,
  BridgeRequest,
  BridgeResponse,
  ToolName,
  ToolSpec,
} from '@nudo-tsl/agent-protocol'
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

async function execute(
  request: IncomingRequest,
  handlers: Partial<Record<ToolName, ToolHandler>>,
  context: Omit<ToolContext, 'agent'>,
): Promise<BridgeResponse> {
  const spec = SPECS_BY_NAME.get(request.tool)
  if (spec === undefined) return invalid(request.id, `Unknown tool "${request.tool}".`)

  try {
    const parsed = spec.args.safeParse(request.args)
    if (!parsed.success) {
      return invalid(request.id, `Invalid arguments for ${request.tool}.`, parsed.error.issues)
    }

    const handler = handlers[spec.name]
    if (handler === undefined) {
      return invalid(request.id, `Tool "${request.tool}" is not available.`)
    }

    const result = await handler(parsed.data, { ...context, agent: request.agent })
    if (!result.ok) return failure(request.id, result.error)
    return { kind: 'response', id: request.id, ok: true, result: result.value }
  } catch (thrown) {
    return invalid(request.id, describeThrown(thrown))
  }
}

/** Runs bridge requests one at a time, in arrival order, validating args against the catalog. */
/** A request whose tool name is not yet known to be in the catalog. */
export type IncomingRequest = Omit<BridgeRequest, 'tool'> & { tool: string }

export function createRequestQueue(
  handlers: Partial<Record<ToolName, ToolHandler>>,
  context: Omit<ToolContext, 'agent'>,
): (request: IncomingRequest) => Promise<BridgeResponse> {
  let tail: Promise<unknown> = Promise.resolve()
  return (request) => {
    const response = tail.then(() => execute(request, handlers, context))
    tail = response
    return response
  }
}
