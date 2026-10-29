/** Where the templates browser's preview stands for the selected template. */
export type TemplatePreviewState<Id, Material> =
  | { readonly status: 'idle' }
  | { readonly status: 'compiling'; readonly id: Id }
  | { readonly status: 'ready'; readonly id: Id; readonly material: Material }
  | { readonly status: 'failed'; readonly id: Id }

export interface TemplatePreviewSchedulerOptions<Id, Material> {
  /** Quiet period after a selection before it compiles, so arrowing past a row costs nothing. */
  readonly delayMs: number
  /** Builds the template's material; null when it does not compile. */
  compile(id: Id): Material | null
  /** Frees a material's GPU resources. */
  release(material: Material): void
  onChange(state: TemplatePreviewState<Id, Material>): void
}

export interface TemplatePreviewScheduler<Id, Material> {
  select(id: Id): void
  /**
   * The scene took the material: from now on the scene frees it (when a newer one replaces it, or
   * when it unmounts), so the scheduler must not free it too.
   */
  handOver(material: Material): void
  /** Stops any pending compile and releases every material it built that the scene never took. */
  dispose(): void
}

/**
 * Compiles the template the browser shows, debounced: a selection reports `compiling` at once and
 * compiles once no newer selection came within the delay. Each material has one owner: the
 * scheduler until the scene takes it (`handOver`), the scene after. Closing the browser therefore
 * frees every material exactly once, a material that never reached the screen included.
 */
export function createTemplatePreviewScheduler<Id, Material>(
  options: TemplatePreviewSchedulerOptions<Id, Material>,
): TemplatePreviewScheduler<Id, Material> {
  /** Built and not yet taken by the scene. */
  const kept = new Set<Material>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let selectedId: Id | null = null
  let isDisposed = false

  const compileSelected = (id: Id): void => {
    timer = null
    const material = options.compile(id)
    if (material === null) {
      options.onChange({ status: 'failed', id })
      return
    }
    kept.add(material)
    options.onChange({ status: 'ready', id, material })
  }

  return {
    select(id) {
      if (isDisposed || id === selectedId) return
      selectedId = id
      if (timer !== null) clearTimeout(timer)
      options.onChange({ status: 'compiling', id })
      timer = setTimeout(() => {
        compileSelected(id)
      }, options.delayMs)
    },
    handOver(material) {
      kept.delete(material)
    },
    dispose() {
      isDisposed = true
      if (timer !== null) clearTimeout(timer)
      timer = null
      for (const material of kept) options.release(material)
      kept.clear()
    },
  }
}
