import type { TemplateTextureBindings } from '@/examples/bind-template-textures'
import type { TemplateTexture } from '@/examples/template-texture'
import { putAsset } from '@/features/assets/asset-store'
import { bundledAssets } from '@/features/assets/bundled-assets'
import type { BundledAsset } from '@/features/assets/bundled-assets'
import { textureCache } from '@/features/assets/texture-cache'

/**
 * `preview`: the templates browser draws the template, so its textures are only decoded (held in
 * memory). `open`: the template becomes the graph, so its textures are stored like uploads.
 */
export type TemplateTextureUse = 'preview' | 'open'

export interface TemplateTextureLoad {
  /** The asset id of every texture that loaded, by template texture id. */
  readonly bindings: TemplateTextureBindings
  /** The textures that did not: their slots stay unbound and read as missing. */
  readonly failed: readonly TemplateTexture[]
}

export interface TemplateTextureSources {
  fetchAsset(url: string): Promise<BundledAsset>
  /** Decodes the asset into the texture cache; resolves whether it became ready. */
  loadTexture(assetId: string): Promise<boolean>
  /** Stores the file and resolves its asset id (the same file always gets the same id). */
  storeAsset(file: Blob): Promise<string>
}

export type LoadTemplateTextures = (
  textures: readonly TemplateTexture[],
  use: TemplateTextureUse,
) => Promise<TemplateTextureLoad>

/** The texture's asset id, or null when it can't be fetched, decoded or (to open) stored. */
async function loadOne(
  sources: TemplateTextureSources,
  texture: TemplateTexture,
  use: TemplateTextureUse,
): Promise<string | null> {
  try {
    const asset = await sources.fetchAsset(texture.file)
    if (!(await sources.loadTexture(asset.assetId))) {
      throw new Error('the image does not decode')
    }
    return use === 'open' ? await sources.storeAsset(asset.file) : asset.assetId
  } catch (error) {
    console.warn(`Could not load the template texture "${texture.label}" (${texture.id}):`, error)
    return null
  }
}

/**
 * Loads a template's textures, all at once, and never rejects: each texture either binds to an
 * asset id or is reported as failed. Storing is content-addressed (Task 8's hash), so opening a
 * template again reuses the assets it stored the first time.
 */
export function createTemplateTextureLoader(sources: TemplateTextureSources): LoadTemplateTextures {
  return async (textures, use) => {
    const assetIds = await Promise.all(textures.map((texture) => loadOne(sources, texture, use)))
    const bindings = new Map<string, string>()
    const failed: TemplateTexture[] = []
    textures.forEach((texture, index) => {
      const assetId = assetIds[index] ?? null
      if (assetId === null) failed.push(texture)
      else bindings.set(texture.id, assetId)
    })
    return { bindings, failed }
  }
}

async function loadIntoTextureCache(assetId: string): Promise<boolean> {
  // `reload`: an asset the cache once found missing is looked up again, now that it is held.
  await textureCache.reload(assetId)
  return textureCache.getSnapshot(assetId).state === 'ready'
}

export const loadTemplateTextures: LoadTemplateTextures = createTemplateTextureLoader({
  fetchAsset: (url) => bundledAssets.fetch(url),
  loadTexture: loadIntoTextureCache,
  storeAsset: putAsset,
})
