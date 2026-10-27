import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

function overflowsVertically(element: HTMLElement): boolean {
  return element.scrollHeight > element.clientHeight
}

/**
 * Whether the element's content is taller than the element, so it scrolls. Measured again when
 * the element is resized and whenever `content` changes.
 */
export function useScrollOverflow(ref: RefObject<HTMLElement | null>, content: string): boolean {
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return
    const observer = new ResizeObserver(() => {
      setOverflows(overflowsVertically(element))
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [ref])

  useLayoutEffect(() => {
    const element = ref.current
    if (element !== null) setOverflows(overflowsVertically(element))
  }, [ref, content])

  return overflows
}
