import { isWebSocketUpgrade, parseBridgePath } from './bridge-route'

export { BridgeRoom } from './bridge-room'

const parseAllowedOrigins = (value: string): ReadonlySet<string> =>
  new Set(
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ''),
  )

const isAllowedOrigin = (origin: string | null, allowedOrigins: string): boolean =>
  origin !== null && parseAllowedOrigins(allowedOrigins).has(origin)

const handleBridge = (
  request: Request,
  env: Cloudflare.Env,
  roomHash: string,
): Promise<Response> | Response => {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })
  if (!isAllowedOrigin(request.headers.get('Origin'), env.ALLOWED_ORIGINS)) {
    return new Response('Forbidden', { status: 403 })
  }
  if (!isWebSocketUpgrade(request)) {
    return new Response('Expected a WebSocket upgrade', { status: 426 })
  }
  const room = env.BRIDGE_ROOM.get(env.BRIDGE_ROOM.idFromName(roomHash))
  return room.fetch(request)
}

export default {
  fetch(request, env) {
    const roomHash = parseBridgePath(new URL(request.url).pathname)
    if (roomHash !== null) return handleBridge(request, env, roomHash)
    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Cloudflare.Env>
