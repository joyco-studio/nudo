import { useCallback, useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

export interface ScrollMetrics {
  readonly scrollTop: number
  readonly scrollHeight: number
  readonly clientHeight: number
}

export interface ScrollOverflow {
  /** The content is taller than the box. */
  readonly isScrollable: boolean
  /** Some of it is still below the fold. */
  readonly hasMoreBelow: boolean
}

/** Browsers round scroll positions at fractional zoom: within this, the end counts as reached. */
const END_TOLERANCE_PX = 1

export function scrollOverflow({
  scrollTop,
  scrollHeight,
  clientHeight,
}: ScrollMetrics): ScrollOverflow {
  const isScrollable = scrollHeight - clientHeight > END_TOLERANCE_PX
  return {
    isScrollable,
    hasMoreBelow: isScrollable && scrollHeight - clientHeight - scrollTop > END_TOLERANCE_PX,
  }
}

const NO_OVERFLOW: ScrollOverflow = { isScrollable: false, hasMoreBelow: false }

const sameOverflow = (a: ScrollOverflow, b: ScrollOverflow): boolean =>
  a.isScrollable === b.isScrollable && a.hasMoreBelow === b.hasMoreBelow

/**
 * Whether a scroll box overflows and still has content below, kept up to date as it scrolls,
 * resizes or its content changes. `contentKey` names the content, so new content is measured.
 */
export function useScrollOverflow(
  ref: RefObject<HTMLElement | null>,
  contentKey: unknown,
): ScrollOverflow {
  const [overflow, setOverflow] = useState<ScrollOverflow>(NO_OVERFLOW)

  const measure = useCallback(() => {
    const element = ref.current
    if (element === null) return
    const next = scrollOverflow(element)
    setOverflow((current) => (sameOverflow(current, next) ? current : next))
  }, [ref])

  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    for (const child of element.children) observer.observe(child)
    element.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      element.removeEventListener('scroll', measure)
    }
  }, [ref, measure, contentKey])

  return overflow
}
