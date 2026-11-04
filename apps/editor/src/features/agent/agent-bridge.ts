import { adoptExistingKey, loadKey, loadOrCreateKey, parseAgentKey, rotateKey } from './agent-key'
import type { KeyStorage } from './agent-key'
import type { BridgeClient } from './bridge-client'

export interface AgentBridgeOptions {
  /** The MCP Worker's base URL; null when this build has none configured. */
  url: string | null
  storage: KeyStorage
  /** Builds a client for `key` at `url` (the session wires the socket, the queue and the status). */
  createClient: (key: string, url: string) => BridgeClient
}

/**
 * What pasting a key the person already uses does: switches to it, finds it already in use, finds
 * no key in the input, or nothing, because this build has no agent server.
 */
export type KeyAdoption = 'adopted' | 'unchanged' | 'invalid' | 'unconfigured'

/** What the connect dialog needs from the bridge. */
export interface AgentBridgeHandle {
  readonly url: string | null
  readonly currentKey: () => string | null
  /** Creates the key on first use and starts the connection; the key, or null when unconfigured. */
  readonly connect: () => string | null
  /** Replaces the key and reconnects with it; the new key, or null when unconfigured. */
  readonly generateNewKey: () => string | null
  /**
   * Switches to a key the person already uses in another browser (bare, `Bearer <key>` or the
   * whole command) and reconnects with it, like `generateNewKey`; the same key changes nothing.
   */
  readonly adoptKey: (input: string) => KeyAdoption
  /** Calls `listener` whenever the key changes (here or in another tab). Returns the unsubscribe. */
  readonly subscribeKey: (listener: () => void) => () => void
}

export interface AgentBridge extends AgentBridgeHandle {
  /** Reconnects on page load, but only when the person paired an agent before. */
  readonly resume: () => void
  /**
   * Adopts the key stored by another tab (after it generated a new one): reconnects with it, so
   * no tab keeps serving the old key.
   */
  readonly syncStoredKey: () => void
  readonly dispose: () => void
}

/** Owns the pairing key and the one bridge client that uses it. Knows nothing about React. */
export function createAgentBridge({ url, storage, createClient }: AgentBridgeOptions): AgentBridge {
  let key: string | null = loadKey(storage)
  let client: BridgeClient | null = null
  const keyListeners = new Set<() => void>()
  const notifyKeyChange = (): void => {
    for (const listener of keyListeners) listener()
  }

  const startWith = (baseUrl: string, nextKey: string): void => {
    client?.stop()
    key = nextKey
    client = createClient(nextKey, baseUrl)
    client.start()
  }

  /** Reconnects with a key that replaced the old one, and tells the listeners. */
  const switchTo = (baseUrl: string, nextKey: string): void => {
    startWith(baseUrl, nextKey)
    notifyKeyChange()
  }

  return {
    url,
    currentKey: () => key,
    connect() {
      if (url === null) return null
      if (client !== null && key !== null) return key
      startWith(url, loadOrCreateKey(storage))
      return key
    },
    generateNewKey() {
      if (url === null) return null
      switchTo(url, rotateKey(storage))
      return key
    },
    adoptKey(input) {
      if (url === null) return 'unconfigured'
      const pasted = parseAgentKey(input)
      if (pasted === null) return 'invalid'
      if (pasted === key) return 'unchanged'
      const adopted = adoptExistingKey(storage, pasted)
      if (adopted === null) return 'invalid'
      switchTo(url, adopted)
      return 'adopted'
    },
    syncStoredKey() {
      const stored = loadKey(storage)
      if (stored === null || stored === key) return
      if (url !== null) {
        switchTo(url, stored)
        return
      }
      key = stored
      notifyKeyChange()
    },
    subscribeKey(listener) {
      keyListeners.add(listener)
      return () => {
        keyListeners.delete(listener)
      }
    },
    resume() {
      if (url === null || client !== null || key === null) return
      startWith(url, key)
    },
    dispose() {
      client?.stop()
      client = null
    },
  }
}
