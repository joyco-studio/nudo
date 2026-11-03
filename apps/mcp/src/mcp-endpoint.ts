import {
  hashKey,
  TOOL_CATALOG,
  type AgentError,
  type AgentIdentity,
  type ToolSpec,
} from '@nudo-tsl/agent-protocol'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { DispatchRequest, DispatchResult } from './bridge-room'

const SERVER_INFO = { name: 'nudo', version: '1.0.0' }
const FALLBACK_AGENT_NAME = 'Agent'
const SESSION_HEADER = 'Mcp-Session-Id'
const BEARER_PATTERN = /^Bearer\s+(\S+)\s*$/i
const JSON_RPC_UNAUTHORIZED = -32001
const JSON_RPC_SERVER_ERROR = -32000
const PREVIEW_IMAGE_TOOL = 'get_preview_image'

const MISSING_KEY_MESSAGE =
  'Missing nudo key. Copy the command from nudo\'s "Connect an agent" dialog and add the server again.'
const MISSING_SESSION_MESSAGE = 'Bad Request: Mcp-Session-Id header is required.'
const NO_SERVER_STREAM_MESSAGE = 'This server does not open a server-to-client stream.'
const NOT_CONNECTED_MESSAGE =
  'nudo is not open. Ask the person to open nudo in their browser; it reconnects by itself.'
const BAD_IMAGE_MESSAGE = 'The nudo tab returned a preview image in an unexpected shape.'

/**
 * The room's RPC surface as this module uses it. `DurableObjectStub<BridgeRoom>` types `dispatch`
 * as returning `never` because its `unknown` args and result are not provably serializable; the
 * stub is still assignable here, and at runtime `dispatch` resolves to a `DispatchResult`.
 */
export interface Room {
  dispatch: (request: DispatchRequest) => Promise<DispatchResult>
  registerSession: (sessionId: string, clientName: string) => Promise<void>
  touchSession: (sessionId: string) => Promise<string | null>
  forgetSession: (sessionId: string) => Promise<void>
}

const initializeMessageSchema = z.object({
  method: z.literal('initialize'),
  params: z.object({ clientInfo: z.object({ name: z.string() }) }),
})

/** The tab sends a PNG, or a WebP or JPEG when a noisy preview needs compressing to fit. */
const previewImageSchema = z.object({
  mimeType: z.enum(['image/png', 'image/webp', 'image/jpeg']),
  data: z.string(),
})

const jsonRpcError = (status: number, code: number, message: string): Response =>
  Response.json({ jsonrpc: '2.0', error: { code, message }, id: null }, { status })

const bearerKey = (request: Request): string | null =>
  BEARER_PATTERN.exec(request.headers.get('Authorization') ?? '')?.[1] ?? null

const roomForKey = async (env: Cloudflare.Env, key: string): Promise<Room> =>
  env.BRIDGE_ROOM.get(env.BRIDGE_ROOM.idFromName(await hashKey(key)))

/** The client name from an `initialize` request body, or null when the body is anything else. */
const initializeClientName = async (request: Request): Promise<string | null> => {
  let body: unknown
  try {
    body = await request.clone().json()
  } catch {
    return null
  }
  const messages: unknown[] = Array.isArray(body) ? body : [body]
  for (const message of messages) {
    const parsed = initializeMessageSchema.safeParse(message)
    if (parsed.success) return parsed.data.params.clientInfo.name
  }
  return null
}

const textContent = (text: string): TextContent => ({ type: 'text', text })

const agentErrorResult = (error: AgentError): CallToolResult => {
  const message = error.code === 'not_connected' ? NOT_CONNECTED_MESSAGE : error.message
  const content = [textContent(`${error.code}: ${message}`)]
  if (error.state !== undefined) content.push(textContent(JSON.stringify(error.state)))
  return { isError: true, content }
}

const previewImageResult = (value: unknown): CallToolResult => {
  const parsed = previewImageSchema.safeParse(value)
  if (!parsed.success) return agentErrorResult({ code: 'invalid', message: BAD_IMAGE_MESSAGE })
  return { content: [{ type: 'image', mimeType: parsed.data.mimeType, data: parsed.data.data }] }
}

/** Turns a room dispatch result into the MCP tool result the agent sees. */
const toToolResult = (tool: ToolSpec['name'], result: DispatchResult): CallToolResult => {
  if (!result.ok) return agentErrorResult(result.error)
  if (tool === PREVIEW_IMAGE_TOOL) return previewImageResult(result.value)
  return { content: [textContent(JSON.stringify(result.value ?? null))] }
}

/** Resolves who is calling: the client name stored for the session at initialize time. */
const resolveAgent = async (room: Room, sessionId: string): Promise<AgentIdentity> => {
  const name = await room.touchSession(sessionId)
  return { sessionId, name: name === null || name === '' ? FALLBACK_AGENT_NAME : name }
}

const describeThrown = (thrown: unknown): string =>
  thrown instanceof Error ? thrown.message : String(thrown)

/**
 * Forwards one tool call to the room. A thrown RPC (the Durable Object was reset or the network
 * dropped) is a lost connection to the tab, not a server failure: the agent sees `not_connected`
 * with the reason and can call again.
 */
export const callTool = async (
  room: Room,
  sessionId: string,
  spec: ToolSpec,
  args: unknown,
): Promise<CallToolResult> => {
  try {
    const agent = await resolveAgent(room, sessionId)
    const result = await room.dispatch({ tool: spec.name, args, agent, timeoutMs: spec.timeoutMs })
    return toToolResult(spec.name, result)
  } catch (thrown) {
    return { isError: true, content: [textContent(`not_connected: ${describeThrown(thrown)}`)] }
  }
}

const createServer = (room: Room, sessionId: string): McpServer => {
  const server = new McpServer(SERVER_INFO)
  for (const spec of TOOL_CATALOG) {
    server.registerTool(
      spec.name,
      { description: spec.description, inputSchema: spec.args },
      (args: unknown): Promise<CallToolResult> => callTool(room, sessionId, spec, args),
    )
  }
  return server
}

/**
 * Builds a transport for one HTTP request. The SDK keeps session state in memory, which would
 * break when another isolate serves the next request, so every request gets a fresh server:
 * `initialize` runs in stateful mode (the SDK issues `Mcp-Session-Id` and the client name is
 * stored in the room), and later requests run in stateless mode, with the session id read from
 * the header and the client name read back from the room.
 */
const statelessTransport = (): WebStandardStreamableHTTPServerTransport =>
  new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true })

const initializingTransport = (
  room: Room,
  sessionId: string,
  clientName: string,
): WebStandardStreamableHTTPServerTransport =>
  new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: () => sessionId,
    onsessioninitialized: () => room.registerSession(sessionId, clientName),
  })

const serve = async (
  request: Request,
  server: McpServer,
  transport: WebStandardStreamableHTTPServerTransport,
): Promise<Response> => {
  await server.connect(transport)
  return transport.handleRequest(request)
}

const handleMcpPost = async (request: Request, room: Room): Promise<Response> => {
  const clientName = await initializeClientName(request)
  if (clientName !== null) {
    const sessionId = crypto.randomUUID()
    return serve(
      request,
      createServer(room, sessionId),
      initializingTransport(room, sessionId, clientName),
    )
  }
  const sessionId = request.headers.get(SESSION_HEADER)
  if (sessionId === null) return jsonRpcError(400, JSON_RPC_SERVER_ERROR, MISSING_SESSION_MESSAGE)
  return serve(request, createServer(room, sessionId), statelessTransport())
}

/** The client ended its session: the room forgets it. Ending is best effort, so it always succeeds. */
const handleMcpDelete = async (request: Request, room: Room): Promise<Response> => {
  const sessionId = request.headers.get(SESSION_HEADER)
  if (sessionId === null) return jsonRpcError(400, JSON_RPC_SERVER_ERROR, MISSING_SESSION_MESSAGE)
  try {
    await room.forgetSession(sessionId)
  } catch {
    // The room is unreachable; its alarm forgets the session later.
  }
  return new Response(null, { status: 200 })
}

/**
 * Serves the nudo tools over MCP Streamable HTTP. The bearer key is the only protection (CLIs
 * call this route, so there is no Origin check); it picks the room and is never logged.
 */
export const handleMcp = async (request: Request, env: Cloudflare.Env): Promise<Response> => {
  const key = bearerKey(request)
  if (key === null) return jsonRpcError(401, JSON_RPC_UNAUTHORIZED, MISSING_KEY_MESSAGE)

  if (request.method === 'GET') {
    return new Response(NO_SERVER_STREAM_MESSAGE, { status: 405, headers: { Allow: 'POST' } })
  }
  if (request.method === 'DELETE') return handleMcpDelete(request, await roomForKey(env, key))
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'POST, DELETE' } })
  }
  return handleMcpPost(request, await roomForKey(env, key))
}
