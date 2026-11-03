const BRIDGE_PATH_PATTERN = /^\/bridge\/([0-9a-f]{64})$/

/** Returns the room hash of a `/bridge/<sha256 hex>` path, or null for any other path. */
export const parseBridgePath = (pathname: string): string | null =>
  BRIDGE_PATH_PATTERN.exec(pathname)?.[1] ?? null

/** True when the request asks to upgrade to a WebSocket (the header value is case-insensitive). */
export const isWebSocketUpgrade = (request: Request): boolean =>
  request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
