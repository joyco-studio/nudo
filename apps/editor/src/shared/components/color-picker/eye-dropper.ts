/** The EyeDropper API (Chromium only), which TypeScript's DOM library does not describe yet. */
interface EyeDropperInstance {
  open(): Promise<unknown>
}

type EyeDropperConstructor = new () => EyeDropperInstance

function isEyeDropperConstructor(value: unknown): value is EyeDropperConstructor {
  return typeof value === 'function'
}

function hexOfResult(result: unknown): string | null {
  if (typeof result !== 'object' || result === null || !('sRGBHex' in result)) return null
  return typeof result.sRGBHex === 'string' ? result.sRGBHex : null
}

function eyeDropperConstructor(): EyeDropperConstructor | null {
  const candidate: unknown = Reflect.get(window, 'EyeDropper')
  return isEyeDropperConstructor(candidate) ? candidate : null
}

/** True when the browser can pick a color from anywhere on screen. */
export function hasEyeDropper(): boolean {
  return eyeDropperConstructor() !== null
}

/**
 * Lets the user pick a color from the screen. Resolves to its sRGB hex, or null when the pick was
 * cancelled (Escape) or the browser cannot pick: there is nothing to apply either way.
 */
export async function pickScreenColor(): Promise<string | null> {
  const EyeDropper = eyeDropperConstructor()
  if (EyeDropper === null) return null
  try {
    return hexOfResult(await new EyeDropper().open())
  } catch {
    return null
  }
}
