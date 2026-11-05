import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION, hashKey } from '@nudo-tsl/agent-protocol'
import type { BridgeRequest, BridgeResponse } from '@nudo-tsl/agent-protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBridgeClient } from './bridge-client'
import type { BridgeSocket, ConnectionStatus } from './bridge-client'

const OPEN = 1
const CLOSED = 3

class FakeSocket {
  readyState = 0
  readonly sent: string[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  closeCalls = 0
  constructor(readonly url: string) {}
  send(data: string): void {
    this.sent.push(data)
  }
  close(): void {
    this.closeCalls += 1
    this.readyState = CLOSED
  }
  open(): void {
    this.readyState = OPEN
    this.onopen?.(new Event('open'))
  }
  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
  drop(): void {
    this.readyState = CLOSED
    this.onclose?.(new CloseEvent('close'))
  }
}

const REQUEST: BridgeRequest = {
  kind: 'request',
  id: 'r1',
  tool: 'get_graph',
  args: {},
  agent: { sessionId: 's1', name: 'Claude' },
  timeoutMs: 15_000,
}

interface Harness {
  sockets: FakeSocket[]
  statuses: ConnectionStatus[]
  onRequest: ReturnType<typeof vi.fn<(request: BridgeRequest) => Promise<BridgeResponse>>>
  client: ReturnType<typeof createBridgeClient>
}

function setup(
  isFocused: () => boolean = () => true,
  isOriginRefused: (url: string) => Promise<boolean> = () => Promise.resolve(false),
): Harness {
  const sockets: FakeSocket[] = []
  const statuses: ConnectionStatus[] = []
  const onRequest = vi.fn<(request: BridgeRequest) => Promise<BridgeResponse>>(() =>
    Promise.resolve({ kind: 'response', id: 'r1', ok: true, result: { done: true } }),
  )
  const client = createBridgeClient({
    url: 'http://localhost:8787',
    key: 'secret',
    tabId: 'tab-a',
    socketFactory: (url) => {
      const socket = new FakeSocket(url)
      sockets.push(socket)
      return socket
    },
    onRequest,
    onStatus: (status) => statuses.push(status),
    isFocused,
    isOriginRefused,
  })
  return { sockets, statuses, onRequest, client }
}

const flush = () => vi.advanceTimersByTimeAsync(0)

async function startAndOpen(harness: Harness): Promise<FakeSocket> {
  harness.client.start()
  await vi.waitFor(() => {
    expect(harness.sockets.length).toBeGreaterThan(0)
  })
  const socket = harness.sockets[harness.sockets.length - 1]
  if (socket === undefined) throw new Error('No socket was created')
  socket.open()
  return socket
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('bridge client', () => {
  it('sends hello with the key and tab id on open', async () => {
    const harness = setup()
    const socket = await startAndOpen(harness)
    expect(socket.url).toBe(`http://localhost:8787/bridge/${await hashKey('secret')}`)
    expect(JSON.parse(socket.sent[0] ?? '')).toEqual({
      kind: 'hello',
      protocolVersion: PROTOCOL_VERSION,
      key: 'secret',
      tabId: 'tab-a',
      focused: true,
    })
    expect(harness.statuses).toEqual(['connecting'])
  })

  it('says in hello when the tab is in the background, so it does not take over', async () => {
    const harness = setup(() => false)
    const socket = await startAndOpen(harness)
    expect(JSON.parse(socket.sent[0] ?? '')).toMatchObject({ kind: 'hello', focused: false })
  })

  it('maps welcome to connected and active-tab changes to other-tab', async () => {
    const harness = setup()
    const socket = await startAndOpen(harness)
    socket.receive({ kind: 'welcome', activeTabId: 'tab-a' })
    socket.receive({ kind: 'active-tab', activeTabId: 'tab-b' })
    socket.receive({ kind: 'active-tab', activeTabId: 'tab-a' })
    expect(harness.statuses).toEqual(['connecting', 'connected', 'other-tab', 'connected'])
  })

  it('maps rejected bad_key to status bad-key and stops reconnecting', async () => {
    const harness = setup()
    const socket = await startAndOpen(harness)
    socket.receive({ kind: 'rejected', reason: 'bad_key' })
    socket.drop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(harness.statuses.at(-1)).toBe('bad-key')
    expect(harness.sockets).toHaveLength(1)
  })

  it('maps protocol_mismatch to outdated', async () => {
    const harness = setup()
    const socket = await startAndOpen(harness)
    socket.receive({ kind: 'rejected', reason: 'protocol_mismatch' })
    socket.drop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(harness.statuses.at(-1)).toBe('outdated')
    expect(harness.sockets).toHaveLength(1)
  })

  it('reports other-tab when active-tab names another tab', async () => {
    const harness = setup()
    const socket = await startAndOpen(harness)
    socket.receive({ kind: 'welcome', activeTabId: 'tab-b' })
    expect(harness.statuses.at(-1)).toBe('other-tab')
  })

  it("answers a request with onRequest's response", async () => {
    const harness = setup()
    const socket = await startAndOpen(harness)
    socket.receive({ kind: 'welcome', activeTabId: 'tab-a' })
    socket.receive(REQUEST)
    await flush()
    expect(harness.onRequest).toHaveBeenCalledWith(REQUEST)
    expect(JSON.parse(socket.sent[1] ?? '')).toEqual({
      kind: 'response',
      id: 'r1',
      ok: true,
      result: { done: true },
    })
  })

  it('answers with an error response when onRequest throws', async () => {
    const harness = setup()
    harness.onRequest.mockRejectedValueOnce(new Error('boom'))
    const socket = await startAndOpen(harness)
    socket.receive(REQUEST)
    await flush()
    const reply: unknown = JSON.parse(socket.sent[1] ?? '')
    expect(reply).toMatchObject({ kind: 'response', id: 'r1', ok: false })
  })

  it('never sends a response over the message limit: it answers invalid for that request', async () => {
    const harness = setup()
    harness.onRequest.mockResolvedValueOnce({
      kind: 'response',
      id: 'r1',
      ok: true,
      result: { mimeType: 'image/png', data: 'A'.repeat(MAX_MESSAGE_BYTES) },
    })
    const socket = await startAndOpen(harness)
    socket.receive(REQUEST)
    await flush()

    const frame = socket.sent[1] ?? ''
    expect(new TextEncoder().encode(frame).byteLength).toBeLessThanOrEqual(MAX_MESSAGE_BYTES)
    expect(JSON.parse(frame)).toMatchObject({
      kind: 'response',
      id: 'r1',
      ok: false,
      error: { code: 'invalid' },
    })
  })

  it('ignores a room error message without closing or changing status', async () => {
    const harness = setup()
    const socket = await startAndOpen(harness)
    socket.receive({ kind: 'welcome', activeTabId: 'tab-a' })
    const statusCount = harness.statuses.length
    socket.receive({ kind: 'error', error: { code: 'invalid', message: 'bad frame' } })
    expect(socket.closeCalls).toBe(0)
    expect(harness.statuses).toHaveLength(statusCount)
    expect(harness.statuses.at(-1)).toBe('connected')
  })

  it('claims focus when the window gains focus', async () => {
    const harness = setup()
    const socket = await startAndOpen(harness)
    window.dispatchEvent(new Event('focus'))
    expect(JSON.parse(socket.sent[1] ?? '')).toEqual({ kind: 'focus', tabId: 'tab-a' })
    harness.client.stop()
    window.dispatchEvent(new Event('focus'))
    expect(socket.sent).toHaveLength(2)
  })

  it('reconnects after close with 1s then 2s backoff', async () => {
    const harness = setup()
    const first = await startAndOpen(harness)
    first.drop()
    expect(harness.statuses.at(-1)).toBe('unreachable')
    await vi.advanceTimersByTimeAsync(999)
    expect(harness.sockets).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(harness.sockets).toHaveLength(2)
    harness.sockets[1]?.drop()
    await vi.advanceTimersByTimeAsync(1999)
    expect(harness.sockets).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(harness.sockets).toHaveLength(3)
  })

  it('says the origin is refused when the server turned the socket down before it opened', async () => {
    const probed: string[] = []
    const harness = setup(
      () => true,
      (url) => {
        probed.push(url)
        return Promise.resolve(true)
      },
    )
    harness.client.start()
    await vi.waitFor(() => {
      expect(harness.sockets).toHaveLength(1)
    })
    harness.sockets[0]?.drop()
    await flush()

    expect(probed).toEqual([`http://localhost:8787/bridge/${await hashKey('secret')}`])
    expect(harness.statuses.at(-1)).toBe('origin-refused')
    // It keeps trying, so fixing the server's allowlist is enough.
    await vi.advanceTimersByTimeAsync(1_000)
    await flush()
    expect(harness.sockets).toHaveLength(2)
  })

  it('stays unreachable when a socket that never opened was not refused', async () => {
    const harness = setup()
    harness.client.start()
    await vi.waitFor(() => {
      expect(harness.sockets).toHaveLength(1)
    })
    harness.sockets[0]?.drop()
    await flush()
    expect(harness.statuses.at(-1)).toBe('unreachable')
  })

  it('stop closes the socket, reports off and cancels reconnects', async () => {
    const harness = setup()
    const socket = await startAndOpen(harness)
    harness.client.stop()
    expect(socket.closeCalls).toBe(1)
    expect(harness.statuses.at(-1)).toBe('off')
    socket.drop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(harness.sockets).toHaveLength(1)
  })
})

/** Type-level guard: a real WebSocket factory is assignable without a cast. Never called. */
export const realSocketFactory: (url: string) => BridgeSocket = (url) => new WebSocket(url)
