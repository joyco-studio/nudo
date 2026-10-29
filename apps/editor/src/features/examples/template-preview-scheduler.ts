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

export interface TemplatePreviewScheduler<Id> {
  select(id: Id): void
  /** Stops any pending compile and releases every material it built. */
  dispose(): void
}

/**
 * Compiles the template the browser shows, debounced: a selection reports `compiling` at once and
 * compiles once no newer selection came within the delay. It owns the materials it builds, so
 * closing the browser leaves nothing on the GPU, even a material that never reached the screen.
 */
export function createTemplatePreviewScheduler<Id, Material>(
  options: TemplatePreviewSchedulerOptions<Id, Material>,
): TemplatePreviewScheduler<Id> {
  const built = new Set<Material>()
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
    built.add(material)
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
    dispose() {
      isDisposed = true
      if (timer !== null) clearTimeout(timer)
      timer = null
      for (const material of built) options.release(material)
      built.clear()
    },
  }
}
