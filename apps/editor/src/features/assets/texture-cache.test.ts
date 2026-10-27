import { DataTexture } from 'three'
import type { Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { createTextureCache } from './texture-cache'

const makeTexture = (): Texture => new DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1)

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function setUp(assets: Readonly<Record<string, Blob>> = {}) {
  const readAsset = vi.fn((id: string): Promise<Blob | null> => Promise.resolve(assets[id] ?? null))
  const decode = vi.fn((): Promise<Texture> => Promise.resolve(makeTexture()))
  const cache = createTextureCache({ readAsset, decode })
  return { cache, readAsset, decode }
}

const PNG = new Blob(['png'], { type: 'image/png' })

describe('texture cache', () => {
  it('is empty for no asset and loading for an asset nobody asked for yet', () => {
    const { cache } = setUp()

    expect(cache.getSnapshot(null).state).toBe('empty')
    expect(cache.getSnapshot('a').state).toBe('loading')
    expect(cache.peek('a')).toBeNull()
  })

  it('loads a stored asset into a ready texture', async () => {
    const { cache } = setUp({ a: PNG })

    await cache.load('a')

    const snapshot = cache.getSnapshot('a')
    expect(snapshot.state).toBe('ready')
    expect(snapshot.texture).not.toBeNull()
    expect(cache.peek('a')).toBe(snapshot.texture)
  })

  it('marks an asset missing when the store has no bytes for it', async () => {
    const { cache, decode } = setUp()

    await cache.load('ghost')

    expect(cache.getSnapshot('ghost').state).toBe('missing')
    expect(cache.peek('ghost')).toBeNull()
    expect(decode).not.toHaveBeenCalled()
  })

  it('marks an asset missing when the store or the decoder fails', async () => {
    const readAsset = vi.fn((): Promise<Blob | null> => Promise.reject(new Error('no storage')))
    const decode = vi.fn((): Promise<Texture> => Promise.reject(new Error('bad image')))
    const cache = createTextureCache({ readAsset, decode })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await cache.load('a')
    expect(cache.getSnapshot('a').state).toBe('missing')

    readAsset.mockResolvedValue(PNG)
    await cache.reload('a')
    expect(cache.getSnapshot('a').state).toBe('missing')
    warn.mockRestore()
  })

  it('loads each asset once however many callers ask', async () => {
    const { cache, readAsset } = setUp({ a: PNG })

    await Promise.all([cache.load('a'), cache.load('a')])
    await cache.load('a')

    expect(readAsset).toHaveBeenCalledOnce()
  })

  it('shows loading while the bytes are being read', async () => {
    const pending = deferred<Blob | null>()
    const cache = createTextureCache({
      readAsset: () => pending.promise,
      decode: () => Promise.resolve(makeTexture()),
    })

    const loading = cache.load('a')
    expect(cache.getSnapshot('a').state).toBe('loading')

    pending.resolve(PNG)
    await loading
    expect(cache.getSnapshot('a').state).toBe('ready')
  })

  it('notifies listeners when an asset becomes ready or missing, with its id and state', async () => {
    const { cache } = setUp({ a: PNG })
    const listener = vi.fn<(assetId: string, state: 'ready' | 'missing') => void>()
    const unsubscribe = cache.subscribe(listener)

    await cache.load('a')
    await cache.load('ghost')
    unsubscribe()
    await cache.reload('a')

    expect(listener.mock.calls).toEqual([
      ['a', 'ready'],
      ['ghost', 'missing'],
    ])
  })

  it('a listener that throws neither rejects the load nor starves the other listeners', async () => {
    const { cache } = setUp({ a: PNG })
    const reached = vi.fn()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    cache.subscribe(() => {
      throw new Error('listener failed')
    })
    cache.subscribe(reached)

    await expect(cache.load('a')).resolves.toBeUndefined()

    expect(cache.getSnapshot('a').state).toBe('ready')
    expect(reached).toHaveBeenCalledOnce()
    expect(error).toHaveBeenCalledOnce()
    error.mockRestore()
  })

  it('keeps one stable snapshot object per state, for useSyncExternalStore', async () => {
    const { cache } = setUp({ a: PNG })
    await cache.load('a')

    expect(cache.getSnapshot('a')).toBe(cache.getSnapshot('a'))
    expect(cache.getSnapshot('unknown')).toBe(cache.getSnapshot('another'))
    expect(cache.getSnapshot(null)).toBe(cache.getSnapshot(null))
  })

  it('reload reads the store again, so a file chosen after a miss is picked up', async () => {
    const assets: Record<string, Blob> = {}
    const readAsset = vi.fn((id: string): Promise<Blob | null> =>
      Promise.resolve(assets[id] ?? null),
    )
    const cache = createTextureCache({ readAsset, decode: () => Promise.resolve(makeTexture()) })
    await cache.load('a')
    expect(cache.getSnapshot('a').state).toBe('missing')

    assets.a = PNG
    await cache.reload('a')

    expect(cache.getSnapshot('a').state).toBe('ready')
  })
})
