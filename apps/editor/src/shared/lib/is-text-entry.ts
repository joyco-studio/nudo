/**
 * Whether the target is a field the user types into, which keeps its own keys and clipboard. A
 * select counts: typing a letter there picks the option that starts with it.
 */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}
