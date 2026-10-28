import { isStructurallyEqual } from '@/shared/lib/structurally-equal'

/** What React Flow nodes and edges share: an id, and the data their views render. */
interface FlowElement {
  readonly id: string
  readonly data?: unknown
}

function shareElement<T extends FlowElement>(previous: T | undefined, next: T): T {
  if (previous === undefined) return next
  if (isStructurallyEqual(previous, next)) return previous
  if (!isStructurallyEqual(previous.data, next.data)) return next
  return { ...next, data: previous.data }
}

/**
 * `next`, with each element structurally equal to the previous element of the same id swapped for
 * that previous object, and each changed element whose data did not change given the previous data.
 * React Flow skips nodes and edges whose object it already has, and a memoized view skips the
 * render when its data keeps its identity: a drag re-renders only what moved. When nothing changed
 * at all, the previous array itself comes back.
 */
export function shareUnchanged<T extends FlowElement>(previous: T[], next: T[]): T[] {
  const previousById = new Map(previous.map((element) => [element.id, element]))
  const shared = next.map((element) => shareElement(previousById.get(element.id), element))
  const isUnchanged =
    shared.length === previous.length &&
    shared.every((element, index) => element === previous[index])
  return isUnchanged ? previous : shared
}

/** `shareUnchanged` against whatever the previous call returned, for one stream of elements. */
export function createUnchangedSharer<T extends FlowElement>(): (next: T[]) => T[] {
  let previous: T[] = []
  return (next) => {
    previous = shareUnchanged(previous, next)
    return previous
  }
}
