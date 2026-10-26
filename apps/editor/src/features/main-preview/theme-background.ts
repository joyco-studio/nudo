import { cssColorToHex } from './css-color-to-hex'

const FALLBACK_HEX = '#000000'
const THEME_CLASS_ATTRIBUTE = 'class'

let cached: { className: string; hex: string } | null = null

function readBackgroundTokenHex(): string {
  const token = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
  return cssColorToHex(token) ?? FALLBACK_HEX
}

/** Fires when the theme provider switches the class that holds the color tokens. */
export function subscribeToThemeBackground(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [THEME_CLASS_ATTRIBUTE],
  })
  return () => {
    observer.disconnect()
  }
}

/** The resolved `--background` token as `#rrggbb`, recomputed only when the theme class changes. */
export function getThemeBackgroundHex(): string {
  const className = document.documentElement.className
  if (cached?.className !== className) cached = { className, hex: readBackgroundTokenHex() }
  return cached.hex
}
