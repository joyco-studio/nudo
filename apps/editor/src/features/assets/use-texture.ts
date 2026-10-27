import { useEffect, useSyncExternalStore } from 'react'

import { textureCache } from './texture-cache'
import type { TextureSnapshot } from './texture-cache'

/**
 * The decoded texture of an asset and how loading is going: `empty` without an asset, `loading`
 * until it is read from IndexedDB, then `ready` or `missing`.
 */
export function useTexture(assetId: string | null): TextureSnapshot {
  useEffect(() => {
    if (assetId !== null) void textureCache.load(assetId)
  }, [assetId])

  return useSyncExternalStore(
    (onChange) => textureCache.subscribe(onChange),
    () => textureCache.getSnapshot(assetId),
  )
}
