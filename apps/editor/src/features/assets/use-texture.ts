import { useEffect, useSyncExternalStore } from 'react'

import { textureCache } from './texture-cache'
import type { TextureSnapshot } from './texture-cache'

/** Module-level, so React keeps one subscription instead of resubscribing on every render. */
const subscribeToTextures = (onChange: () => void): (() => void) =>
  textureCache.subscribe(() => {
    onChange()
  })

/**
 * The decoded texture of an asset and how loading is going: `empty` without an asset, `loading`
 * until it is read from IndexedDB, then `ready` or `missing`.
 */
export function useTexture(assetId: string | null): TextureSnapshot {
  useEffect(() => {
    if (assetId !== null) void textureCache.load(assetId)
  }, [assetId])

  return useSyncExternalStore(subscribeToTextures, () => textureCache.getSnapshot(assetId))
}
