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
  /**
   * The textures that did not load (fetch or decode failed, or took longer than the timeout):
   * their slots stay unbound and read as missing.
   */
  readonly failed: readonly TemplateTexture[]
  /**
   * Opening only: textures that loaded but could not be stored. They are bound to the in-memory
   * asset, so they draw for this session, and are missing after a reload.
   */
  readonly unsaved: readonly TemplateTexture[]
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

/** A bundled image that hasn't arrived by then counts as failed: its slots read as missing. */
export const TEXTURE_LOAD_TIMEOUT_MS = 10_000

type TextureOutcome =
  { readonly kind: 'bound' | 'unsaved'; readonly assetId: string } | { readonly kind: 'failed' }

const FAILED: TextureOutcome = { kind: 'failed' }

/** Settles like `promise`, or rejects once `timeoutMs` passes first. */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`no answer after ${String(timeoutMs)} ms`))
    }, timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

function warn(texture: TemplateTexture, what: string, error: unknown): void {
  console.warn(`The template texture ${texture.id} (${texture.file}) ${what}:`, error)
}

async function fetchAndDecode(
  sources: TemplateTextureSources,
  texture: TemplateTexture,
): Promise<BundledAsset> {
  const asset = await sources.fetchAsset(texture.file)
  if (!(await sources.loadTexture(asset.assetId))) throw new Error('the image does not decode')
  return asset
}

async function loadOne(
  sources: TemplateTextureSources,
  texture: TemplateTexture,
  use: TemplateTextureUse,
  timeoutMs: number,
): Promise<TextureOutcome> {
  let asset: BundledAsset
  try {
    asset = await withTimeout(fetchAndDecode(sources, texture), timeoutMs)
  } catch (error) {
    warn(texture, 'did not load', error)
    return FAILED
  }
  if (use === 'preview') return { kind: 'bound', assetId: asset.assetId }
  try {
    return { kind: 'bound', assetId: await sources.storeAsset(asset.file) }
  } catch (error) {
    // It decoded and is held in memory under the same id: it draws now, it just won't survive.
    warn(texture, 'could not be stored', error)
    return { kind: 'unsaved', assetId: asset.assetId }
  }
}

/**
 * Loads a template's textures, all at once, and never rejects: each texture binds to an asset id
 * (stored, or for opening only held in memory when it can't be stored) or is reported as failed.
 * Storing is content-addressed (Task 8's hash), so opening a template again reuses the assets it
 * stored the first time.
 */
export function createTemplateTextureLoader(
  sources: TemplateTextureSources,
  timeoutMs: number = TEXTURE_LOAD_TIMEOUT_MS,
): LoadTemplateTextures {
  return async (textures, use) => {
    const outcomes = await Promise.all(
      textures.map((texture) => loadOne(sources, texture, use, timeoutMs)),
    )
    const bindings = new Map<string, string>()
    const failed: TemplateTexture[] = []
    const unsaved: TemplateTexture[] = []
    textures.forEach((texture, index) => {
      const outcome = outcomes[index] ?? FAILED
      if (outcome.kind === 'failed') {
        failed.push(texture)
        return
      }
      bindings.set(texture.id, outcome.assetId)
      if (outcome.kind === 'unsaved') unsaved.push(texture)
    })
    return { bindings, failed, unsaved }
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
