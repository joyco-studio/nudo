import type { Texture } from 'three'

import { getAsset } from './asset-store'
import { decodeImageBlob } from './decode-image-blob'

export type TextureSnapshot =
  | { readonly state: 'empty' | 'loading' | 'missing'; readonly texture: null }
  | { readonly state: 'ready'; readonly texture: Texture }

export type SettledTextureState = 'ready' | 'missing'

/** Called with the id of every asset that finished loading, and whether it became ready or missing. */
export type TextureCacheListener = (assetId: string, state: SettledTextureState) => void

export interface TextureCache {
  /**
   * What an asset is right now. An asset nobody has asked for reads as `loading`, and the returned
   * object is the same until the state changes, so it works as a `useSyncExternalStore` snapshot.
   */
  getSnapshot(assetId: string | null): TextureSnapshot
  /** The texture when the asset is ready, `null` otherwise. Starts loading an unrequested asset. */
  peek(assetId: string): Texture | null
  /** Resolves once the asset is ready or known to be missing; loads each asset once. */
  load(assetId: string): Promise<void>
  /** Like `load`, but looks the store up again if the asset was missing (a file was just added). */
  reload(assetId: string): Promise<void>
  subscribe(listener: TextureCacheListener): () => void
}

export interface TextureCacheSources {
  readAsset(assetId: string): Promise<Blob | null>
  decode(file: Blob): Promise<Texture>
}

const EMPTY: TextureSnapshot = { state: 'empty', texture: null }
const LOADING: TextureSnapshot = { state: 'loading', texture: null }
const MISSING: TextureSnapshot = { state: 'missing', texture: null }

interface CacheEntry {
  snapshot: TextureSnapshot
  /** Settles when the asset stops loading; never rejects. */
  loaded: Promise<void>
}

// TODO: textures are cached for the page lifetime. There is no eviction and the object URL behind
// each decoded image (see decode-image-blob.ts) is never revoked. Add reference counting from the
// texture fields and the live material when many or large assets make that matter.
export function createTextureCache(sources: TextureCacheSources): TextureCache {
  const entries = new Map<string, CacheEntry>()
  const listeners = new Set<TextureCacheListener>()

  const settle = (assetId: string, snapshot: TextureSnapshot): void => {
    const entry = entries.get(assetId)
    if (entry === undefined) return
    entry.snapshot = snapshot
    const state: SettledTextureState = snapshot.state === 'ready' ? 'ready' : 'missing'
    for (const listener of listeners) {
      // One failing subscriber must not reject the load or hide the result from the others.
      try {
        listener(assetId, state)
      } catch (error) {
        console.error(`A texture cache listener failed for ${assetId}:`, error)
      }
    }
  }

  const fetchTexture = async (assetId: string): Promise<TextureSnapshot> => {
    try {
      const file = await sources.readAsset(assetId)
      if (file === null) return MISSING
      return { state: 'ready', texture: await sources.decode(file) }
    } catch (error) {
      console.warn(`Could not load texture asset ${assetId}:`, error)
      return MISSING
    }
  }

  const load = (assetId: string): Promise<void> => {
    const existing = entries.get(assetId)
    if (existing !== undefined) return existing.loaded
    const entry: CacheEntry = {
      snapshot: LOADING,
      loaded: fetchTexture(assetId).then((snapshot) => {
        settle(assetId, snapshot)
      }),
    }
    entries.set(assetId, entry)
    return entry.loaded
  }

  return {
    getSnapshot: (assetId) =>
      assetId === null ? EMPTY : (entries.get(assetId)?.snapshot ?? LOADING),
    peek: (assetId) => {
      void load(assetId)
      return entries.get(assetId)?.snapshot.texture ?? null
    },
    load,
    reload: (assetId) => {
      if (entries.get(assetId)?.snapshot === MISSING) entries.delete(assetId)
      return load(assetId)
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** The editor's one cache: every preview and every texture field share the decoded textures. */
export const textureCache: TextureCache = createTextureCache({
  readAsset: getAsset,
  decode: decodeImageBlob,
})
