import { isWebSocketUpgrade, parseBridgePath } from './bridge-route'
import { handleMcp } from './mcp-endpoint'

export { BridgeRoom } from './bridge-room'

const MCP_PATH = '/mcp'

const parseAllowedOrigins = (value: string): ReadonlySet<string> =>
  new Set(
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ''),
  )

const isAllowedOrigin = (origin: string | null, allowedOrigins: string): boolean =>
  origin !== null && parseAllowedOrigins(allowedOrigins).has(origin)

/**
 * The refusals a browser probe reads (a plain GET, no upgrade): any page may see the status, so
 * the editor can tell "origin not allowed" from "server down". They carry no data.
 */
const readableRefusal = (body: string, status: number): Response =>
  new Response(body, { status, headers: { 'Access-Control-Allow-Origin': '*' } })

const handleBridge = (
  request: Request,
  env: Cloudflare.Env,
  roomHash: string,
): Promise<Response> | Response => {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })
  if (!isAllowedOrigin(request.headers.get('Origin'), env.ALLOWED_ORIGINS)) {
    return readableRefusal('Forbidden', 403)
  }
  if (!isWebSocketUpgrade(request)) {
    return readableRefusal('Expected a WebSocket upgrade', 426)
  }
  const room = env.BRIDGE_ROOM.get(env.BRIDGE_ROOM.idFromName(roomHash))
  return room.fetch(request)
}

export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url)
    // No Origin check on /mcp: CLIs call it, and the bearer key is its protection.
    if (pathname === MCP_PATH) return handleMcp(request, env)
    const roomHash = parseBridgePath(pathname)
    if (roomHash !== null) return handleBridge(request, env, roomHash)
    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Cloudflare.Env>
