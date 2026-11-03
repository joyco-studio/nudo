const STORAGE_KEY = 'nudo-tsl:agent-key'
const KEY_BYTES = 32

type KeyStorage = Pick<Storage, 'getItem' | 'setItem'>

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function generateKey(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(KEY_BYTES)))
}

function readStoredKey(storage: KeyStorage): string | null {
  try {
    return storage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function storeKey(storage: KeyStorage, key: string): void {
  try {
    storage.setItem(STORAGE_KEY, key)
  } catch {
    // Storage is blocked: the key lives only as long as the value the caller holds.
  }
}

/** Returns the stored key, creating and storing one on first use. */
export function loadOrCreateKey(storage: KeyStorage): string {
  const stored = readStoredKey(storage)
  if (stored !== null && stored !== '') return stored
  return rotateKey(storage)
}

/** Replaces the key, which disconnects any agent still using the old one. */
export function rotateKey(storage: KeyStorage): string {
  const key = generateKey()
  storeKey(storage, key)
  return key
}
