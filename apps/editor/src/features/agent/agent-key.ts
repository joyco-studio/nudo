const STORAGE_KEY = 'nudo-tsl:agent-key'
const KEY_BYTES = 32

/** 32 random bytes in base64url without padding: exactly 43 characters of the URL-safe alphabet. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/
/** A key after "Bearer", as in the header of the connect command or `claude mcp get nudo`. */
const BEARER_TOKEN = /\bBearer\s+([^\s"']+)/gi

export type KeyStorage = Pick<Storage, 'getItem' | 'setItem'>

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function generateKey(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(KEY_BYTES)))
}

/** Whether `value` has the shape of a key this editor generates. */
export function isAgentKey(value: string): boolean {
  return KEY_PATTERN.test(value)
}

/**
 * The key in what the person pasted: the bare key, `Bearer <key>`, or the whole connect command.
 * Null unless it holds exactly one well-formed key.
 */
export function parseAgentKey(input: string): string | null {
  const trimmed = input.trim()
  if (isAgentKey(trimmed)) return trimmed
  const tokens = [...trimmed.matchAll(BEARER_TOKEN)].map((match) => match[1] ?? '')
  const [token] = tokens
  return tokens.length === 1 && token !== undefined && isAgentKey(token) ? token : null
}

/** The stored key when it is well formed; a malformed value counts as none. */
function readStoredKey(storage: KeyStorage): string | null {
  try {
    const stored = storage.getItem(STORAGE_KEY)
    return stored !== null && isAgentKey(stored) ? stored : null
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
  return readStoredKey(storage) ?? rotateKey(storage)
}

/** Replaces the key, which disconnects any agent still using the old one. */
export function rotateKey(storage: KeyStorage): string {
  const key = generateKey()
  storeKey(storage, key)
  return key
}

/**
 * Stores the key the person already uses elsewhere (pasted bare, as `Bearer <key>` or as the whole
 * command), so this browser joins the agent without reconfiguring it. The key, or null when the
 * input holds none and the stored key stays as it was.
 */
export function adoptExistingKey(storage: KeyStorage, input: string): string | null {
  const key = parseAgentKey(input)
  if (key === null) return null
  storeKey(storage, key)
  return key
}

/** The stored key, without creating one: null until the person first opens "Connect an agent". */
export function loadKey(storage: KeyStorage): string | null {
  return readStoredKey(storage)
}

/**
 * Calls `onChange` when another tab changes the stored key (a `storage` event for it, or a cleared
 * storage). Returns the unsubscribe.
 */
export function watchKeyChanges(target: Window, onChange: () => void): () => void {
  const listener = (event: StorageEvent): void => {
    if (event.key === null || event.key === STORAGE_KEY) onChange()
  }
  target.addEventListener('storage', listener)
  return () => {
    target.removeEventListener('storage', listener)
  }
}
