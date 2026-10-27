/** The list sonner renders its toasts in; the keyboard hotkey (Alt+T) focuses it. */
export const TOASTER_SELECTOR = '[data-sonner-toaster]'
const FRONT_TOAST_SELECTOR = '[data-sonner-toast][data-front="true"]'

export function isInsideToaster(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TOASTER_SELECTOR) !== null
}

export interface ToasterFocus {
  /** Moves focus back out of the toasts, but only if it is still in them. */
  returnFocus(): void
  stop(): void
}

/** The list itself has no focus ring (it is a zero-height box); its front toast has one. */
function focusFrontToast(list: Element): void {
  const front = list.querySelector<HTMLElement>(FRONT_TOAST_SELECTOR)
  front?.focus()
}

/**
 * Remembers what had focus before it moved into the toasts (Alt+T, Tab), so closing a toast does
 * not strand it on a removed element. Focus that lands on the list (Alt+T) moves on to the front
 * toast, so the person sees where it is. `fallback` is where focus goes when nothing was remembered
 * or the remembered element is gone.
 */
export function trackToasterFocus(doc: Document, fallback: () => HTMLElement | null): ToasterFocus {
  let opener: HTMLElement | null = null

  const onFocusIn = (event: FocusEvent): void => {
    if (!isInsideToaster(event.target)) return
    const origin = event.relatedTarget
    if (origin instanceof HTMLElement && !isInsideToaster(origin)) opener = origin
    if (event.target instanceof Element && event.target.matches(TOASTER_SELECTOR)) {
      focusFrontToast(event.target)
    }
  }
  doc.addEventListener('focusin', onFocusIn)

  return {
    returnFocus: () => {
      if (!isInsideToaster(doc.activeElement)) return
      const target = opener?.isConnected === true ? opener : fallback()
      opener = null
      target?.focus()
    },
    stop: () => {
      doc.removeEventListener('focusin', onFocusIn)
    },
  }
}
