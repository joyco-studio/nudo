import { useCallback, useEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

type PressEventShape = Pick<PointerEvent, 'pointerType' | 'isPrimary' | 'button'>

const PRIMARY_BUTTON = 0

/**
 * True for a person pressing with the primary button of a real pointer (mouse, pen, touch).
 * A press without a pointer type is script firing events (motion/react's tap gesture answers Enter
 * that way), and a keyboard activation never produces a pointer event at all.
 */
export function isPointerPress({ pointerType, isPrimary, button }: PressEventShape): boolean {
  return pointerType !== '' && isPrimary && button === PRIMARY_BUTTON
}

export interface PointerPress {
  readonly isPressed: boolean
  readonly onPointerDown: (event: ReactPointerEvent) => void
}

/**
 * Whether a real pointer is holding the element down, until the pointer lets go anywhere on the
 * page (a drag off the element still releases it).
 */
export function usePointerPress(): PointerPress {
  const [isPressed, setIsPressed] = useState(false)

  useEffect(() => {
    if (!isPressed) return undefined
    const release = (): void => {
      setIsPressed(false)
    }
    // Capture, so a descendant that stops its own pointerup can't leave the element held down.
    window.addEventListener('pointerup', release, { capture: true })
    window.addEventListener('pointercancel', release, { capture: true })
    return () => {
      window.removeEventListener('pointerup', release, { capture: true })
      window.removeEventListener('pointercancel', release, { capture: true })
    }
  }, [isPressed])

  const onPointerDown = useCallback((event: ReactPointerEvent): void => {
    if (isPointerPress(event.nativeEvent)) setIsPressed(true)
  }, [])

  return { isPressed, onPointerDown }
}
