import {
  hashKey,
  parseRoomMessage,
  PROTOCOL_VERSION,
  type RoomMessage,
} from '@nudo-tsl/agent-protocol'
import { env, exports } from 'cloudflare:workers'

export const TEST_ORIGIN = 'http://localhost:5173'
const WAIT_TIMEOUT_MS = 2_000

export interface CloseInfo {
  code: number
  reason: string
}

export interface TestSocket {
  /** Every room message received so far, in order. */
  readonly received: readonly RoomMessage[]
  send: (message: unknown) => void
  sendRaw: (frame: string | ArrayBuffer) => void
  /** Resolves with the oldest not-yet-consumed message of the given kind, waiting if none arrived yet. */
  next: <K extends RoomMessage['kind']>(kind: K) => Promise<Extract<RoomMessage, { kind: K }>>
  closed: Promise<CloseInfo>
  close: () => void
}

export const bridgeRequest = (hash: string, origin: string = TEST_ORIGIN): Request =>
  new Request(`https://nudo-mcp.test/bridge/${hash}`, {
    headers: { Upgrade: 'websocket', Origin: origin },
  })

const isKind =
  <K extends RoomMessage['kind']>(kind: K) =>
  (message: RoomMessage): message is Extract<RoomMessage, { kind: K }> =>
    message.kind === kind

export const openBridgeSocket = async (hash: string): Promise<TestSocket> => {
  const response = await exports.default.fetch(bridgeRequest(hash))
  const socket = response.webSocket
  if (socket === null)
    throw new Error(`Expected a WebSocket upgrade, got ${String(response.status)}`)
  socket.accept()

  const received: RoomMessage[] = []
  const consumed = new Set<RoomMessage>()
  const listeners = new Set<() => void>()

  socket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return
    const parsed = parseRoomMessage(event.data)
    if (!parsed.ok) throw new Error(`Room sent an invalid message: ${event.data}`)
    received.push(parsed.value)
    listeners.forEach((listener) => {
      listener()
    })
  })

  const closed = new Promise<CloseInfo>((resolve) => {
    socket.addEventListener('close', (event) => {
      resolve({ code: event.code, reason: event.reason })
    })
  })

  const next = <K extends RoomMessage['kind']>(kind: K) =>
    new Promise<Extract<RoomMessage, { kind: K }>>((resolve, reject) => {
      const matches = isKind(kind)
      const check = (): boolean => {
        const found = received.find(
          (message): message is Extract<RoomMessage, { kind: K }> =>
            matches(message) && !consumed.has(message),
        )
        if (found === undefined) return false
        consumed.add(found)
        listeners.delete(onMessage)
        clearTimeout(timer)
        resolve(found)
        return true
      }
      const onMessage = (): void => {
        check()
      }
      const timer = setTimeout(() => {
        listeners.delete(onMessage)
        reject(new Error(`Timed out waiting for a ${kind} message`))
      }, WAIT_TIMEOUT_MS)
      if (!check()) listeners.add(onMessage)
    })

  return {
    received,
    send: (message) => {
      socket.send(JSON.stringify(message))
    },
    sendRaw: (frame) => {
      socket.send(frame)
    },
    next,
    closed,
    close: () => {
      socket.close(1000, 'test done')
    },
  }
}

export const helloMessage = (key: string, tabId: string, focused = true) => ({
  kind: 'hello',
  protocolVersion: PROTOCOL_VERSION,
  key,
  tabId,
  focused,
})

/**
 * Opens a socket for `key`, sends hello as `tabId` (a focused tab unless `focused` is false) and
 * waits for the welcome.
 */
export const connectTab = async (key: string, tabId: string, focused = true): Promise<TestSocket> => {
  const socket = await openBridgeSocket(await hashKey(key))
  socket.send(helloMessage(key, tabId, focused))
  await socket.next('welcome')
  return socket
}

export const roomFor = async (key: string) =>
  env.BRIDGE_ROOM.get(env.BRIDGE_ROOM.idFromName(await hashKey(key)))
