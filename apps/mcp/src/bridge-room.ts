import {
  hashKey,
  MAX_MESSAGE_BYTES,
  parseBrowserMessage,
  PROTOCOL_VERSION,
  type AgentError,
  type AgentIdentity,
  type BridgeResponse,
  type BrowserMessage,
  type RoomMessage,
  type ToolName,
} from '@nudo-tsl/agent-protocol'
import { err, ok, type Result } from '@nudo-tsl/core'
import { DurableObject } from 'cloudflare:workers'
import { z } from 'zod'
import { isWebSocketUpgrade, parseBridgePath } from './bridge-route'

export interface DispatchRequest {
  tool: ToolName
  args: unknown
  agent: AgentIdentity
  timeoutMs: number
}

export type DispatchResult = Result<unknown, AgentError>

const CLOSE_CODE_BAD_KEY = 4001
const CLOSE_CODE_PROTOCOL_MISMATCH = 4002
const SESSION_KEY_PREFIX = 'session:'

/** Per-socket state kept with the Hibernation API, so it survives the object being evicted. */
const socketAttachmentSchema = z.object({
  roomHash: z.string(),
  connectionId: z.string(),
  /** Null until the socket sends a valid hello. */
  tabId: z.string().nullable(),
  /** Increases every time the tab sends hello or focus; the highest value is the active tab. */
  activatedAt: z.number(),
})

type SocketAttachment = z.infer<typeof socketAttachmentSchema>

interface ConnectedTab {
  socket: WebSocket
  attachment: SocketAttachment & { tabId: string }
}

interface PendingRequest {
  connectionId: string
  resolve: (result: DispatchResult) => void
  timer: ReturnType<typeof setTimeout>
}

const agentError = (code: AgentError['code'], message: string): AgentError => ({ code, message })

const NOT_CONNECTED = agentError('not_connected', 'No nudo tab is connected for this key.')
const TAB_CLOSED = agentError('not_connected', 'The nudo tab closed before it answered.')

const timeoutError = (timeoutMs: number): AgentError =>
  agentError('timeout', `The nudo tab did not answer within ${String(timeoutMs)} ms.`)

const byteSize = (frame: string | ArrayBuffer): number =>
  typeof frame === 'string' ? new TextEncoder().encode(frame).byteLength : frame.byteLength

const frameText = (frame: string | ArrayBuffer): string =>
  typeof frame === 'string' ? frame : new TextDecoder().decode(frame)

const sendMessage = (socket: WebSocket, message: RoomMessage): void => {
  socket.send(JSON.stringify(message))
}

const sendInvalid = (socket: WebSocket, message: string): void => {
  sendMessage(socket, { kind: 'error', error: agentError('invalid', message) })
}

const readAttachment = (socket: WebSocket): SocketAttachment | null => {
  const raw: unknown = socket.deserializeAttachment()
  const parsed = socketAttachmentSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

const writeAttachment = (socket: WebSocket, attachment: SocketAttachment): void => {
  socket.serializeAttachment(attachment)
}

const toConnectedTab = (socket: WebSocket): ConnectedTab | null => {
  const attachment = readAttachment(socket)
  if (attachment?.tabId == null) return null
  return { socket, attachment: { ...attachment, tabId: attachment.tabId } }
}

const responseResult = (response: BridgeResponse): DispatchResult =>
  response.ok ? ok(response.result) : err(response.error)

const sessionKey = (sessionId: string): string => `${SESSION_KEY_PREFIX}${sessionId}`

/**
 * One room per key hash. It holds the editor tabs' WebSockets and routes each tool call to the
 * active tab (the last one that sent hello or focus), resolving when that tab answers.
 */
export class BridgeRoom extends DurableObject {
  private readonly pending = new Map<string, PendingRequest>()

  override fetch(request: Request): Response {
    const roomHash = parseBridgePath(new URL(request.url).pathname)
    if (roomHash === null) return new Response('Not found', { status: 404 })
    if (!isWebSocketUpgrade(request)) {
      return new Response('Expected a WebSocket upgrade', { status: 426 })
    }

    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    writeAttachment(server, {
      roomHash,
      connectionId: crypto.randomUUID(),
      tabId: null,
      activatedAt: 0,
    })
    return new Response(null, { status: 101, webSocket: client })
  }

  dispatch(request: DispatchRequest): Promise<DispatchResult> {
    const activeTab = this.activeTab()
    if (activeTab === null) return Promise.resolve(err(NOT_CONNECTED))

    const id = crypto.randomUUID()
    return new Promise<DispatchResult>((resolve) => {
      const timer = setTimeout(() => {
        this.settle(id, err(timeoutError(request.timeoutMs)))
      }, request.timeoutMs)
      this.pending.set(id, { connectionId: activeTab.attachment.connectionId, resolve, timer })
      try {
        sendMessage(activeTab.socket, {
          kind: 'request',
          id,
          tool: request.tool,
          args: request.args,
          agent: request.agent,
        })
      } catch {
        this.settle(id, err(TAB_CLOSED))
      }
    })
  }

  async registerSession(sessionId: string, clientName: string): Promise<void> {
    await this.ctx.storage.put(sessionKey(sessionId), clientName)
  }

  async clientName(sessionId: string): Promise<string | null> {
    const stored = await this.ctx.storage.get(sessionKey(sessionId))
    return typeof stored === 'string' ? stored : null
  }

  override async webSocketMessage(socket: WebSocket, frame: string | ArrayBuffer): Promise<void> {
    const attachment = readAttachment(socket)
    if (attachment === null) return

    if (byteSize(frame) > MAX_MESSAGE_BYTES) {
      sendInvalid(socket, 'Message exceeds the maximum size.')
      return
    }
    const parsed = parseBrowserMessage(frameText(frame))
    if (!parsed.ok) {
      sendMessage(socket, { kind: 'error', error: parsed.error })
      return
    }
    await this.handleMessage(socket, attachment, parsed.value)
  }

  override webSocketClose(socket: WebSocket): void {
    this.dropSocket(socket)
  }

  override webSocketError(socket: WebSocket): void {
    this.dropSocket(socket)
  }

  private async handleMessage(
    socket: WebSocket,
    attachment: SocketAttachment,
    message: BrowserMessage,
  ): Promise<void> {
    if (message.kind === 'hello') {
      await this.handleHello(socket, attachment, message)
      return
    }
    if (attachment.tabId === null) {
      sendInvalid(socket, 'The first message has to be hello.')
      return
    }
    if (message.kind === 'focus') {
      this.activate(socket, attachment, attachment.tabId)
      return
    }
    this.handleResponse(attachment, message)
  }

  private async handleHello(
    socket: WebSocket,
    attachment: SocketAttachment,
    hello: Extract<BrowserMessage, { kind: 'hello' }>,
  ): Promise<void> {
    if ((await hashKey(hello.key)) !== attachment.roomHash) {
      this.reject(socket, 'bad_key', CLOSE_CODE_BAD_KEY)
      return
    }
    if (hello.protocolVersion !== PROTOCOL_VERSION) {
      this.reject(socket, 'protocol_mismatch', CLOSE_CODE_PROTOCOL_MISMATCH)
      return
    }
    sendMessage(socket, { kind: 'welcome', activeTabId: hello.tabId })
    this.activate(socket, attachment, hello.tabId)
  }

  private reject(socket: WebSocket, reason: 'bad_key' | 'protocol_mismatch', code: number): void {
    sendMessage(socket, { kind: 'rejected', reason })
    socket.close(code, reason)
  }

  private activate(socket: WebSocket, attachment: SocketAttachment, tabId: string): void {
    writeAttachment(socket, { ...attachment, tabId, activatedAt: this.nextActivation() })
    this.broadcastActiveTab()
  }

  private handleResponse(attachment: SocketAttachment, response: BridgeResponse): void {
    const pending = this.pending.get(response.id)
    // A late answer (after a timeout) or one from a tab that never got the request is ignored.
    if (pending?.connectionId !== attachment.connectionId) return
    this.settle(response.id, responseResult(response))
  }

  private settle(id: string, result: DispatchResult): void {
    const pending = this.pending.get(id)
    if (pending === undefined) return
    clearTimeout(pending.timer)
    this.pending.delete(id)
    pending.resolve(result)
  }

  private dropSocket(socket: WebSocket): void {
    const attachment = readAttachment(socket)
    if (attachment === null) return
    const wasActive = this.activeTab()?.attachment.connectionId === attachment.connectionId

    for (const [id, pending] of this.pending) {
      if (pending.connectionId === attachment.connectionId) this.settle(id, err(TAB_CLOSED))
    }
    if (wasActive) this.broadcastActiveTab(attachment.connectionId)
  }

  private connectedTabs(excludeConnectionId?: string): ConnectedTab[] {
    return this.ctx
      .getWebSockets()
      .map(toConnectedTab)
      .filter(
        (tab): tab is ConnectedTab =>
          tab !== null && tab.attachment.connectionId !== excludeConnectionId,
      )
  }

  private activeTab(excludeConnectionId?: string): ConnectedTab | null {
    return this.connectedTabs(excludeConnectionId).reduce<ConnectedTab | null>(
      (latest, tab) =>
        latest === null || tab.attachment.activatedAt > latest.attachment.activatedAt
          ? tab
          : latest,
      null,
    )
  }

  private nextActivation(): number {
    return Math.max(0, ...this.connectedTabs().map((tab) => tab.attachment.activatedAt)) + 1
  }

  private broadcastActiveTab(excludeConnectionId?: string): void {
    const activeTab = this.activeTab(excludeConnectionId)
    if (activeTab === null) return
    const message: RoomMessage = { kind: 'active-tab', activeTabId: activeTab.attachment.tabId }
    for (const tab of this.connectedTabs(excludeConnectionId)) sendMessage(tab.socket, message)
  }
}
