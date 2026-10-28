const COMBINING_MARKS = /\p{M}/gu

/**
 * Text as every search compares it: lowercase and without accents, so "posicion" finds
 * "Posición" and "espanol" finds "Español". Decomposes first (NFD) so the marks come apart from
 * their letters (ñ becomes n plus a tilde), then drops the marks.
 */
export function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()
}
