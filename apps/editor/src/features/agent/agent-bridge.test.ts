import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

import { createAgentBridge } from './agent-bridge'
import type { BridgeClient } from './bridge-client'

function createMemoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => {
      values.set(name, value)
    },
  }
}

interface FakeClient extends BridgeClient {
  readonly key: string
  readonly start: Mock<() => void>
  readonly stop: Mock<() => void>
}

function setup(url: string | null = 'http://localhost:8787') {
  const clients: FakeClient[] = []
  const storage = createMemoryStorage()
  const bridge = createAgentBridge({
    url,
    storage,
    createClient: (key) => {
      const client: FakeClient = {
        key,
        start: vi.fn<() => void>(),
        stop: vi.fn<() => void>(),
        claimFocus: vi.fn<() => void>(),
      }
      clients.push(client)
      return client
    },
  })
  return { bridge, clients, storage }
}

describe('agent bridge', () => {
  it('creates the key on first connect and starts one client with it', () => {
    const { bridge, clients } = setup()
    expect(bridge.currentKey()).toBeNull()

    const key = bridge.connect()

    expect(key).not.toBeNull()
    expect(bridge.currentKey()).toBe(key)
    expect(clients).toHaveLength(1)
    expect(clients[0]?.key).toBe(key)
    expect(clients[0]?.start).toHaveBeenCalledTimes(1)
    bridge.connect()
    expect(clients).toHaveLength(1)
  })

  it('resumes on load only when a key was stored before', () => {
    const first = setup()
    first.bridge.resume()
    expect(first.clients).toHaveLength(0)
    first.bridge.connect()

    const started = vi.fn()
    const reloaded = createAgentBridge({
      url: 'http://localhost:8787',
      storage: first.storage,
      createClient: () => ({ start: started, stop: vi.fn(), claimFocus: vi.fn() }),
    })
    reloaded.resume()

    expect(started).toHaveBeenCalledTimes(1)
    expect(reloaded.currentKey()).toBe(first.bridge.currentKey())
  })

  it('generating a new key stops the old connection and reconnects with the new key', () => {
    const { bridge, clients } = setup()
    const oldKey = bridge.connect()

    const newKey = bridge.generateNewKey()

    expect(newKey).not.toBe(oldKey)
    expect(bridge.currentKey()).toBe(newKey)
    expect(clients[0]?.stop).toHaveBeenCalledTimes(1)
    expect(clients[1]?.key).toBe(newKey)
    expect(clients[1]?.start).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a configured url', () => {
    const { bridge, clients } = setup(null)
    expect(bridge.connect()).toBeNull()
    expect(bridge.generateNewKey()).toBeNull()
    bridge.resume()
    expect(clients).toHaveLength(0)
  })

  it('stops the client on dispose', () => {
    const { bridge, clients } = setup()
    bridge.connect()
    bridge.dispose()
    expect(clients[0]?.stop).toHaveBeenCalledTimes(1)
  })
})
