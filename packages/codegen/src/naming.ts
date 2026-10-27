const WORD_SEPARATOR = /[^A-Za-z0-9]+/
const FALLBACK_BASE_NAME = 'node'

export const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

/** `Sample Texture 2D` becomes `sampleTexture2d`; a base never starts with a digit. */
export function toCamelCase(label: string): string {
  const words = label
    .split(WORD_SEPARATOR)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase())
  const [first, ...rest] = words
  if (first === undefined) return FALLBACK_BASE_NAME
  const camel = first + rest.map(capitalize).join('')
  return /^[0-9]/.test(camel) ? `${FALLBACK_BASE_NAME}${capitalize(camel)}` : camel
}

const FIRST_COUNT = 1

export interface NameAllocator {
  /** `base1`, `base2`, ...: a 1-based counter per base, skipping names already taken. */
  counted(base: string): string
}

/** Hands out identifiers that never collide with each other or with the `reserved` names. */
export function createNameAllocator(reserved: ReadonlySet<string>): NameAllocator {
  const taken = new Set(reserved)
  const counters = new Map<string, number>()

  const claim = (base: string): string => {
    let count = counters.get(base) ?? FIRST_COUNT
    while (taken.has(`${base}${String(count)}`)) count += 1
    counters.set(base, count + 1)
    const name = `${base}${String(count)}`
    taken.add(name)
    return name
  }

  return {
    counted: claim,
  }
}
