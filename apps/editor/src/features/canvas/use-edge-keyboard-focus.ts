import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

import { isKeyboardModality } from '@/shared/lib/input-modality'

import { FLOW_EDGE_SELECTOR } from './canvas-keyboard-model'

/**
 * True while the React Flow edge around `innerRef` holds focus that came from the keyboard. The
 * edge wrapper is React Flow's, so its focus is read from the DOM rather than from props; a click
 * also focuses it, and that does not count. Escape needs no handling here: React Flow blurs a
 * focused edge on Escape.
 */
export function useEdgeKeyboardFocus(innerRef: RefObject<Element | null>): boolean {
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    const edge = innerRef.current?.closest(FLOW_EDGE_SELECTOR)
    if (edge === null || edge === undefined) return
    const onFocus = (): void => {
      setIsFocused(isKeyboardModality(edge.ownerDocument))
    }
    const onBlur = (): void => {
      setIsFocused(false)
    }
    edge.addEventListener('focus', onFocus)
    edge.addEventListener('blur', onBlur)
    return () => {
      edge.removeEventListener('focus', onFocus)
      edge.removeEventListener('blur', onBlur)
    }
  }, [innerRef])

  return isFocused
}
