/** A label change as text morph (reference 33) sees it: what stays, what leaves, what arrives. */
export interface TextMorphParts {
  /** The letters both labels start with; they stay put. */
  readonly head: string
  /** The old label's letters between the shared start and end. */
  readonly outgoing: string
  /** The new label's letters between the shared start and end. */
  readonly incoming: string
  /** The letters both labels end with, never overlapping `head`. */
  readonly tail: string
}

function sharedStartLength(previous: string, next: string): number {
  let length = 0
  while (length < previous.length && length < next.length && previous[length] === next[length]) {
    length += 1
  }
  return length
}

function sharedEndLength(previous: string, next: string, startLength: number): number {
  const room = Math.min(previous.length, next.length) - startLength
  let length = 0
  while (length < room && previous.at(-1 - length) === next.at(-1 - length)) length += 1
  return length
}

/** Splits `previous` to `next` into the shared start, the two changing middles and the shared end. */
export function splitTextMorph(previous: string, next: string): TextMorphParts {
  const start = sharedStartLength(previous, next)
  const end = sharedEndLength(previous, next, start)
  return {
    head: next.slice(0, start),
    outgoing: previous.slice(start, previous.length - end),
    incoming: next.slice(start, next.length - end),
    tail: next.slice(next.length - end),
  }
}
