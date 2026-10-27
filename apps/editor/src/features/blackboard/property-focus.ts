import type { PropertyId } from '@nudo-tsl/core'

/** Marks a row's handle (the button named after the property); its value is the property id. */
export const PROPERTY_HANDLE_ATTRIBUTE = 'data-property-handle'
/** Marks the panel's "+" button, where focus goes once the last property is deleted. */
export const ADD_PROPERTY_ATTRIBUTE = 'data-add-property'

function handles(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[${PROPERTY_HANDLE_ATTRIBUTE}]`)]
}

export function focusPropertyHandle(propertyId: PropertyId): void {
  handles()
    .find((handle) => handle.getAttribute(PROPERTY_HANDLE_ATTRIBUTE) === propertyId)
    ?.focus()
}

/** Moves focus from one handle to the one `offset` rows away, when there is one. */
export function focusSiblingHandle(from: HTMLElement, offset: 1 | -1): void {
  const all = handles()
  all[all.indexOf(from) + offset]?.focus()
}

/**
 * Where focus goes after a row is deleted: the next row, else the previous one, else the "+"
 * button. Read before the delete, while the row is still there.
 */
export function focusTargetAfterDelete(propertyId: PropertyId): () => void {
  const all = handles()
  const index = all.findIndex(
    (handle) => handle.getAttribute(PROPERTY_HANDLE_ATTRIBUTE) === propertyId,
  )
  const neighbor = all[index + 1] ?? all[index - 1] ?? null
  return () => {
    const target =
      neighbor?.isConnected === true
        ? neighbor
        : document.querySelector<HTMLElement>(`[${ADD_PROPERTY_ATTRIBUTE}]`)
    target?.focus()
  }
}
