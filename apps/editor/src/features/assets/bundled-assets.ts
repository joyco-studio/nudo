import { hashAsset } from './asset-store'

/** A file the editor ships (a template's texture), fetched and keyed like a stored asset. */
export interface BundledAsset {
  /** The lowercase hex SHA-256 of its bytes: the id `putAsset` gives the same file. */
  readonly assetId: string
  readonly file: Blob
}

export interface BundledAssets {
  /** The file at a bundled URL, fetched once per page. A failed fetch rejects and is retried later. */
  fetch(url: string): Promise<BundledAsset>
  /** A file already fetched, by asset id; null when none has that id. Nothing is stored. */
  file(assetId: string): Blob | null
}

export interface BundledAssetSources {
  fetchFile(url: string): Promise<Blob>
  hash(file: Blob): Promise<string>
}

/**
 * The bundled files the page has fetched, held in memory under their content hash. The texture
 * cache reads them like stored assets, so a template's textures draw in the templates browser
 * without being written to IndexedDB first.
 */
export function createBundledAssets(sources: BundledAssetSources): BundledAssets {
  const requests = new Map<string, Promise<BundledAsset>>()
  const files = new Map<string, Blob>()

  const fetchAsset = async (url: string): Promise<BundledAsset> => {
    const file = await sources.fetchFile(url)
    const assetId = await sources.hash(file)
    files.set(assetId, file)
    return { assetId, file }
  }

  return {
    fetch: (url) => {
      const existing = requests.get(url)
      if (existing !== undefined) return existing
      const request = fetchAsset(url)
      requests.set(url, request)
      // A failure is not kept: the next request fetches again.
      request.catch(() => {
        requests.delete(url)
      })
      return request
    },
    file: (assetId) => files.get(assetId) ?? null,
  }
}

async function fetchFile(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} answered ${String(response.status)}`)
  return response.blob()
}

/** The editor's bundled files: the template textures fetched so far. */
export const bundledAssets: BundledAssets = createBundledAssets({ fetchFile, hash: hashAsset })
