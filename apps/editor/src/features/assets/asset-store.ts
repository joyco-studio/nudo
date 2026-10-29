import { createStore, get, set } from 'idb-keyval'
import type { UseStore } from 'idb-keyval'

const DATABASE_NAME = 'nudo-tsl'
const STORE_NAME = 'assets'
const HEX_RADIX = 16
const HEX_DIGITS_PER_BYTE = 2

let assetStore: UseStore | null = null

/** Opened on first use, so importing this module never touches IndexedDB. */
function getAssetStore(): UseStore {
  assetStore ??= createStore(DATABASE_NAME, STORE_NAME)
  return assetStore
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_BYTE, '0'),
  ).join('')
}

/** The lowercase hex SHA-256 of the file's bytes: the same bytes always get the same id. */
export async function hashAsset(file: Blob): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))
}

/**
 * Stores a file in IndexedDB under the SHA-256 of its bytes and returns that id. Storing the same
 * bytes again overwrites the entry with itself, so identical files are kept once.
 */
export async function putAsset(file: Blob): Promise<string> {
  const id = await hashAsset(file)
  await set(id, file, getAssetStore())
  return id
}

/** The stored file, or `null` when no asset has that id. */
export async function getAsset(id: string): Promise<Blob | null> {
  const stored: unknown = await get(id, getAssetStore())
  return stored instanceof Blob ? stored : null
}
