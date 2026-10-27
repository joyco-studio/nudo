import type { Result } from '@nudo-tsl/core'

/** The value of a successful result; a failure here is a bug in the fixture, so it throws. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}
