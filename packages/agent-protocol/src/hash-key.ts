const HEX_RADIX = 16
const HEX_BYTE_WIDTH = 2

/** SHA-256 of the UTF-8 key as lowercase hex. Works in Workers, browsers and Node. */
export const hashKey = async (key: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0'),
  ).join('')
}
