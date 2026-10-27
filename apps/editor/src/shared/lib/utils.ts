import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The font sizes the theme adds (`--text-micro`, `--text-field` in globals.css). Registered so
 * tailwind-merge reads `text-micro` as a size: unknown, it would take it for a color and drop the
 * real color class beside it.
 */
const CUSTOM_FONT_SIZES = ['micro', 'field'] as const

const twMerge = extendTailwindMerge({
  extend: { theme: { text: [...CUSTOM_FONT_SIZES] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
