import { useEffect, useEffectEvent } from 'react'
import { create } from 'zustand'

interface OverlayState {
  /** The one select, popover, context menu or dialog that is open, if any. */
  openId: string | null
}

/**
 * Marks a trigger that stays pressable while another overlay is open (Radix makes the rest of the
 * page inert to the pointer): pressing it closes that overlay and opens this one.
 */
export const EXCLUSIVE_TRIGGER_ATTRIBUTE = 'data-exclusive-trigger'
export const EXCLUSIVE_TRIGGER_PROPS = { [EXCLUSIVE_TRIGGER_ATTRIBUTE]: '' }

const useOverlayStore = create<OverlayState>(() => ({ openId: null }))

/** Marks an overlay as the open one; whichever was open before closes itself. */
export function claimOverlay(id: string): void {
  useOverlayStore.setState({ openId: id })
}

/** Clears the open overlay, unless another one has taken over since. */
export function releaseOverlay(id: string): void {
  if (useOverlayStore.getState().openId === id) useOverlayStore.setState({ openId: null })
}

/** True while a different overlay has taken over: this one must not pull focus back on close. */
export function isOverlayReplaced(id: string): boolean {
  const { openId } = useOverlayStore.getState()
  return openId !== null && openId !== id
}

/** For overlays whose open state can live here (a controlled select or dialog). */
export function useIsOverlayOpen(id: string): boolean {
  return useOverlayStore((state) => state.openId === id)
}

/** True while any select, popover, context menu or dialog is open. */
export function useIsAnyOverlayOpen(): boolean {
  return useOverlayStore((state) => state.openId !== null)
}

/**
 * Closes an overlay that keeps its own open state (a popover session, a context menu) when
 * another one opens. Runs synchronously inside the opening event, before the new overlay mounts.
 */
export function useCloseWhenReplaced(id: string, isOpen: boolean, close: () => void): void {
  const onReplaced = useEffectEvent(close)
  useEffect(() => {
    if (!isOpen) return
    return useOverlayStore.subscribe((state) => {
      if (state.openId !== null && state.openId !== id) onReplaced()
    })
  }, [id, isOpen])
}

/**
 * Radix menus keep their open state to themselves; a press outside is the one thing that closes
 * them, so that is what a replaced menu receives. It is dispatched on the document (it doesn't
 * bubble to the window), where Radix listens for presses outside its layers.
 */
export function dismissTopLayer(): void {
  document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: false }))
}
