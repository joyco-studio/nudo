import { describe, expect, it } from 'vitest'
import { loadOrCreateKey, rotateKey } from './agent-key'

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
