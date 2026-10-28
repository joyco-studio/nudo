function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function arraysEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((item, index) => isStructurallyEqual(item, b[index]))
}

function setsEqual(a: ReadonlySet<unknown>, b: ReadonlySet<unknown>): boolean {
  return a.size === b.size && [...a].every((member) => b.has(member))
}

function objectsEqual(
  a: Readonly<Record<string, unknown>>,
  b: Readonly<Record<string, unknown>>,
): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => Object.hasOwn(b, key) && isStructurallyEqual(a[key], b[key]))
}

/**
 * Deep equality for derived view data: plain objects and arrays by their contents, sets by their
 * members, and everything else (functions, class instances) by identity. Identical references
 * short-circuit, so comparing data that mostly reuses the same objects is cheap. No cycles.
 */
export function isStructurallyEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && arraysEqual(a, b)
  }
  if (a instanceof Set || b instanceof Set) {
    return a instanceof Set && b instanceof Set && setsEqual(a, b)
  }
  return isPlainObject(a) && isPlainObject(b) && objectsEqual(a, b)
}
