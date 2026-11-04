import { describe, expect, it, vi } from 'vitest'
import {
  adoptExistingKey,
  loadKey,
  loadOrCreateKey,
  parseAgentKey,
  rotateKey,
  watchKeyChanges,
} from './agent-key'

const KEY_LENGTH = 43

function createMemoryStorage(): Pick<Storage, 'getItem' | 'setItem'> & {
  readonly values: Map<string, string>
} {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => {
      values.set(name, value)
    },
  }
}

const throwingStorage: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('agent key', () => {
  it('creates a 43-character base64url key once and reuses it', () => {
    const storage = createMemoryStorage()
    const first = loadOrCreateKey(storage)
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(first).toHaveLength(KEY_LENGTH)
    expect(loadOrCreateKey(storage)).toBe(first)
    expect(storage.values.get('nudo-tsl:agent-key')).toBe(first)
  })

  it('rotateKey returns a different key and stores it', () => {
    const storage = createMemoryStorage()
    const first = loadOrCreateKey(storage)
    const rotated = rotateKey(storage)
    expect(rotated).not.toBe(first)
    expect(loadOrCreateKey(storage)).toBe(rotated)
  })

  it('falls back to memory when storage throws', () => {
    const key = loadOrCreateKey(throwingStorage)
    expect(key).toHaveLength(KEY_LENGTH)
    expect(rotateKey(throwingStorage)).toHaveLength(KEY_LENGTH)
  })
})

const VALID_KEY = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde'
const OTHER_KEY = 'zyxwvutsrqponmlkjihgfedcba9876543210_-ZYXWV'

describe('parseAgentKey', () => {
  it('accepts a bare key, trimming whitespace', () => {
    expect(VALID_KEY).toHaveLength(KEY_LENGTH)
    expect(parseAgentKey(VALID_KEY)).toBe(VALID_KEY)
    expect(parseAgentKey(`  ${VALID_KEY}\n`)).toBe(VALID_KEY)
  })

  it('extracts the key from "Bearer <key>" and from the whole connect command', () => {
    expect(parseAgentKey(`Bearer ${VALID_KEY}`)).toBe(VALID_KEY)
    expect(parseAgentKey(`Authorization: Bearer ${VALID_KEY}`)).toBe(VALID_KEY)
    expect(
      parseAgentKey(
        `claude mcp add --scope user --transport http nudo https://x.dev/mcp --header "Authorization: Bearer ${VALID_KEY}"`,
      ),
    ).toBe(VALID_KEY)
  })

  it('rejects anything that is not exactly one well-formed key', () => {
    expect(parseAgentKey('')).toBeNull()
    expect(parseAgentKey('   ')).toBeNull()
    expect(parseAgentKey(VALID_KEY.slice(1))).toBeNull()
    expect(parseAgentKey(`${VALID_KEY}x`)).toBeNull()
    expect(parseAgentKey(`${VALID_KEY.slice(1)}+`)).toBeNull()
    expect(parseAgentKey(`${VALID_KEY.slice(1)}=`)).toBeNull()
    expect(parseAgentKey(`Bearer ${VALID_KEY.slice(2)}`)).toBeNull()
    expect(parseAgentKey(`Bearer ${VALID_KEY} Bearer ${OTHER_KEY}`)).toBeNull()
  })
})

describe('adoptExistingKey', () => {
  it('stores a valid key in place of the current one and returns it', () => {
    const storage = createMemoryStorage()
    loadOrCreateKey(storage)
    expect(adoptExistingKey(storage, ` Bearer ${VALID_KEY} `)).toBe(VALID_KEY)
    expect(storage.values.get('nudo-tsl:agent-key')).toBe(VALID_KEY)
    expect(loadOrCreateKey(storage)).toBe(VALID_KEY)
  })

  it('leaves the stored key alone when the input is not a key', () => {
    const storage = createMemoryStorage()
    const current = loadOrCreateKey(storage)
    expect(adoptExistingKey(storage, 'not a key')).toBeNull()
    expect(storage.values.get('nudo-tsl:agent-key')).toBe(current)
  })
})

describe('stored key validation', () => {
  it('ignores a malformed stored key: loadKey sees none and loadOrCreateKey replaces it', () => {
    const storage = createMemoryStorage()
    storage.values.set('nudo-tsl:agent-key', 'tampered')
    expect(loadKey(storage)).toBeNull()
    const created = loadOrCreateKey(storage)
    expect(created).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(storage.values.get('nudo-tsl:agent-key')).toBe(created)
  })
})

describe('watchKeyChanges', () => {
  it('reports changes to the agent key made in other tabs, and nothing else', () => {
    const onChange = vi.fn<() => void>()
    const stop = watchKeyChanges(window, onChange)

    window.dispatchEvent(new StorageEvent('storage', { key: 'nudo-tsl:theme', newValue: 'dark' }))
    expect(onChange).not.toHaveBeenCalled()
    window.dispatchEvent(new StorageEvent('storage', { key: 'nudo-tsl:agent-key', newValue: 'k' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    // A cleared storage reports a null key.
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(onChange).toHaveBeenCalledTimes(2)

    stop()
    window.dispatchEvent(new StorageEvent('storage', { key: 'nudo-tsl:agent-key', newValue: 'x' }))
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})
