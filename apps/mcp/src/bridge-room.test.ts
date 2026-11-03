import { hashKey, MAX_MESSAGE_BYTES, PROTOCOL_VERSION } from '@nudo-tsl/agent-protocol'
import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { BridgeRoom, SESSION_TTL_MS } from './bridge-room'
import { connectTab, helloMessage, openBridgeSocket, roomFor } from './testing/bridge-socket'

const AGENT = { sessionId: 'session-1', name: 'Test Agent' }
const LONG_TIMEOUT_MS = 5_000
const SHORT_TIMEOUT_MS = 50

const uniqueKey = (): string => `key-${crypto.randomUUID()}`

const dispatchGetGraph = async (key: string, timeoutMs: number = LONG_TIMEOUT_MS) => {
  const room = await roomFor(key)
  return room.dispatch({ tool: 'get_graph', args: {}, agent: AGENT, timeoutMs })
}

describe('BridgeRoom handshake', () => {
  it('closes with 4001 when the hello key does not hash to the room name', async () => {
    const socket = await openBridgeSocket(await hashKey(uniqueKey()))
    socket.send(helloMessage('some-other-key', 'tab-1'))

    await expect(socket.next('rejected')).resolves.toEqual({ kind: 'rejected', reason: 'bad_key' })
    await expect(socket.closed).resolves.toMatchObject({ code: 4001 })
  })

  it('closes with 4002 when the protocol version does not match', async () => {
    const key = uniqueKey()
    const socket = await openBridgeSocket(await hashKey(key))
    socket.send({ ...helloMessage(key, 'tab-1'), protocolVersion: PROTOCOL_VERSION + 1 })

    await expect(socket.next('rejected')).resolves.toEqual({
      kind: 'rejected',
      reason: 'protocol_mismatch',
    })
    await expect(socket.closed).resolves.toMatchObject({ code: 4002 })
  })

  it('welcomes a tab and makes it active', async () => {
    const key = uniqueKey()
    const socket = await openBridgeSocket(await hashKey(key))
    socket.send(helloMessage(key, 'tab-1'))

    await expect(socket.next('welcome')).resolves.toEqual({ kind: 'welcome', activeTabId: 'tab-1' })
    await expect(socket.next('active-tab')).resolves.toEqual({
      kind: 'active-tab',
      activeTabId: 'tab-1',
    })
  })
})

describe('BridgeRoom dispatch', () => {
  it('dispatch resolves not_connected with no tab', async () => {
    const result = await dispatchGetGraph(uniqueKey())
    expect(result).toMatchObject({ ok: false, error: { code: 'not_connected' } })
  })

  it('dispatch round-trips through the active tab', async () => {
    const key = uniqueKey()
    const tab = await connectTab(key, 'tab-1')

    const pending = dispatchGetGraph(key)
    const request = await tab.next('request')
    expect(request).toMatchObject({ tool: 'get_graph', args: {}, agent: AGENT })
    tab.send({ kind: 'response', id: request.id, ok: true, result: { n: 1 } })

    await expect(pending).resolves.toEqual({ ok: true, value: { n: 1 } })
  })

  it('dispatch passes an error response through', async () => {
    const key = uniqueKey()
    const tab = await connectTab(key, 'tab-1')

    const pending = dispatchGetGraph(key)
    const request = await tab.next('request')
    const error = { code: 'not_found', message: 'gone', state: { nodeIds: [] } }
    tab.send({ kind: 'response', id: request.id, ok: false, error })

    await expect(pending).resolves.toEqual({ ok: false, error })
  })

  it('dispatch goes to the most recently focused tab', async () => {
    const key = uniqueKey()
    const first = await connectTab(key, 'tab-1')
    const second = await connectTab(key, 'tab-2')
    first.send({ kind: 'focus', tabId: 'tab-1' })
    await first.next('active-tab') // tab-1 hello
    await first.next('active-tab') // tab-2 hello
    await expect(first.next('active-tab')).resolves.toEqual({
      kind: 'active-tab',
      activeTabId: 'tab-1',
    })
    second.send({ kind: 'focus', tabId: 'tab-2' })
    await second.next('active-tab') // tab-2 hello
    await second.next('active-tab') // tab-1 focus
    await expect(second.next('active-tab')).resolves.toEqual({
      kind: 'active-tab',
      activeTabId: 'tab-2',
    })

    const pending = dispatchGetGraph(key)
    const request = await second.next('request')
    second.send({ kind: 'response', id: request.id, ok: true, result: 'from tab-2' })

    await expect(pending).resolves.toEqual({ ok: true, value: 'from tab-2' })
    expect(first.received.some((message) => message.kind === 'request')).toBe(false)
  })

  it('pending dispatch resolves not_connected when the tab closes', async () => {
    const key = uniqueKey()
    const tab = await connectTab(key, 'tab-1')

    const pending = dispatchGetGraph(key)
    await tab.next('request')
    tab.close()

    await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'not_connected' } })
  })

  it('dispatch resolves timeout after timeoutMs', async () => {
    const key = uniqueKey()
    const tab = await connectTab(key, 'tab-1')

    const pending = dispatchGetGraph(key, SHORT_TIMEOUT_MS)
    await tab.next('request')

    await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'timeout' } })
  })

  it('hands the active tab to the remaining tab when the active one closes', async () => {
    const key = uniqueKey()
    const first = await connectTab(key, 'tab-1')
    const second = await connectTab(key, 'tab-2')
    await first.next('active-tab') // tab-1 hello
    await first.next('active-tab') // tab-2 hello

    second.close()
    await expect(first.next('active-tab')).resolves.toEqual({
      kind: 'active-tab',
      activeTabId: 'tab-1',
    })

    const pending = dispatchGetGraph(key)
    const request = await first.next('request')
    first.send({ kind: 'response', id: request.id, ok: true, result: 'from tab-1' })
    await expect(pending).resolves.toEqual({ ok: true, value: 'from tab-1' })
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'dispatch resolves invalid for timeoutMs %s without sending a request',
    async (timeoutMs) => {
      const key = uniqueKey()
      const tab = await connectTab(key, 'tab-1')

      const result = await dispatchGetGraph(key, timeoutMs)

      expect(result).toMatchObject({ ok: false, error: { code: 'invalid' } })
      expect(tab.received.some((message) => message.kind === 'request')).toBe(false)
    },
  )

  it('ignores a response from a tab that did not receive the request', async () => {
    const key = uniqueKey()
    const first = await connectTab(key, 'tab-1')
    const second = await connectTab(key, 'tab-2')

    const pending = dispatchGetGraph(key)
    const request = await second.next('request')
    first.send({ kind: 'response', id: request.id, ok: true, result: 'impostor' })
    second.send({ kind: 'response', id: request.id, ok: true, result: 'real' })

    await expect(pending).resolves.toEqual({ ok: true, value: 'real' })
  })
})

describe('BridgeRoom malformed input', () => {
  it('an invalid message gets an invalid response and the socket stays open', async () => {
    const key = uniqueKey()
    const tab = await connectTab(key, 'tab-1')

    tab.sendRaw('{ not json')
    await expect(tab.next('error')).resolves.toMatchObject({ error: { code: 'invalid' } })

    const pending = dispatchGetGraph(key)
    const request = await tab.next('request')
    tab.send({ kind: 'response', id: request.id, ok: true, result: null })
    await expect(pending).resolves.toEqual({ ok: true, value: null })
  })

  it('rejects a frame whose UTF-8 size exceeds MAX_MESSAGE_BYTES even if its length does not', async () => {
    const key = uniqueKey()
    const tab = await connectTab(key, 'tab-1')
    const twoByteChar = 'é'
    const frame = twoByteChar.repeat(Math.ceil(MAX_MESSAGE_BYTES / 2) + 1)
    expect(frame.length).toBeLessThan(MAX_MESSAGE_BYTES)

    tab.sendRaw(frame)
    const response = await tab.next('error')
    expect(response.error.code).toBe('invalid')
    expect(response.error.message).toContain('maximum size')
  })

  it('answers a message sent before hello with invalid', async () => {
    const socket = await openBridgeSocket(await hashKey(uniqueKey()))
    socket.send({ kind: 'focus', tabId: 'tab-1' })
    await expect(socket.next('error')).resolves.toMatchObject({ error: { code: 'invalid' } })
  })
})

describe('BridgeRoom sessions', () => {
  it('remembers the client name of a registered session', async () => {
    const room = await roomFor(uniqueKey())
    await room.registerSession('session-1', 'Cursor')

    await expect(room.touchSession('session-1')).resolves.toBe('Cursor')
    await expect(room.touchSession('unknown')).resolves.toBeNull()
    await runInDurableObject(room, async (instance: BridgeRoom) => {
      await expect(instance.touchSession('session-1')).resolves.toBe('Cursor')
    })
  })

  it('forgets a session, and empties its storage when nothing else is left', async () => {
    const room = await roomFor(uniqueKey())
    await room.registerSession('session-1', 'Cursor')

    await room.forgetSession('session-1')

    await expect(room.touchSession('session-1')).resolves.toBeNull()
    await runInDurableObject(room, async (_instance: BridgeRoom, state) => {
      expect((await state.storage.list()).size).toBe(0)
      await expect(state.storage.getAlarm()).resolves.toBeNull()
    })
  })

  it('schedules a cleanup alarm when a session is registered', async () => {
    const room = await roomFor(uniqueKey())
    await room.registerSession('session-1', 'Cursor')

    await runInDurableObject(room, async (_instance: BridgeRoom, state) => {
      const alarm = await state.storage.getAlarm()
      expect(alarm).not.toBeNull()
      expect(alarm ?? 0).toBeGreaterThan(Date.now())
    })
  })

  it('the alarm drops sessions unused for the TTL and keeps recent ones', async () => {
    const room = await roomFor(uniqueKey())
    await room.registerSession('stale', 'Old agent')
    await room.registerSession('fresh', 'Cursor')
    await runInDurableObject(room, async (_instance: BridgeRoom, state) => {
      await state.storage.put('session:stale', {
        clientName: 'Old agent',
        lastUsedAt: Date.now() - SESSION_TTL_MS - 1,
      })
    })

    expect(await runDurableObjectAlarm(room)).toBe(true)

    await expect(room.touchSession('stale')).resolves.toBeNull()
    await expect(room.touchSession('fresh')).resolves.toBe('Cursor')
    await runInDurableObject(room, async (_instance: BridgeRoom, state) => {
      await expect(state.storage.getAlarm()).resolves.not.toBeNull()
    })
  })

  it('the alarm empties the room once every session expired and no tab is connected', async () => {
    const room = await roomFor(uniqueKey())
    await room.registerSession('stale', 'Old agent')
    await runInDurableObject(room, async (_instance: BridgeRoom, state) => {
      await state.storage.put('session:stale', { clientName: 'Old agent', lastUsedAt: 0 })
    })

    expect(await runDurableObjectAlarm(room)).toBe(true)

    await runInDurableObject(room, async (_instance: BridgeRoom, state) => {
      expect((await state.storage.list()).size).toBe(0)
      await expect(state.storage.getAlarm()).resolves.toBeNull()
    })
  })

  it('a lookup marks the session as used, so the alarm keeps it', async () => {
    const room = await roomFor(uniqueKey())
    await room.registerSession('session-1', 'Cursor')
    await runInDurableObject(room, async (_instance: BridgeRoom, state) => {
      await state.storage.put('session:session-1', {
        clientName: 'Cursor',
        lastUsedAt: Date.now() - SESSION_TTL_MS + 60_000,
      })
    })

    await room.touchSession('session-1')
    await runInDurableObject(room, async (_instance: BridgeRoom, state) => {
      const stored: unknown = await state.storage.get('session:session-1')
      const { lastUsedAt } = z.object({ lastUsedAt: z.number() }).parse(stored)
      expect(lastUsedAt).toBeGreaterThan(Date.now() - 60_000)
    })
  })
})
