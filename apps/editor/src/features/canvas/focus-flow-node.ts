/**
 * React Flow keeps a new node hidden until it has measured it, and a hidden element can't take
 * focus. So this retries on each animation frame until the node accepts focus, for at most about
 * half a second at 60 fps.
 */
const MAX_FOCUS_ATTEMPTS = 30

function flowNodeElement(nodeId: string): HTMLElement | null {
  const element = document.querySelector(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`)
  return element instanceof HTMLElement ? element : null
}

/** Moves focus to a canvas node once it is rendered. */
export function focusFlowNode(nodeId: string): void {
  let attempts = 0
  const tryFocus = (): void => {
    const element = flowNodeElement(nodeId)
    element?.focus({ preventScroll: true })
    attempts += 1
    const isFocused = element !== null && document.activeElement === element
    if (!isFocused && attempts < MAX_FOCUS_ATTEMPTS) requestAnimationFrame(tryFocus)
  }
  tryFocus()
}
