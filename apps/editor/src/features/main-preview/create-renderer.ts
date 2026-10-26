import { WebGPURenderer } from 'three/webgpu'

export type RendererBackend = 'webgpu' | 'webgl2'

export type RendererResult =
  { ok: true; renderer: WebGPURenderer; backend: RendererBackend } | { ok: false; message: string }

function detectBackend(renderer: WebGPURenderer): RendererBackend {
  const { backend } = renderer
  return 'isWebGPUBackend' in backend && backend.isWebGPUBackend === true ? 'webgpu' : 'webgl2'
}

function describeFailure(error: unknown): string {
  return error instanceof Error ? error.message : 'The renderer failed to start.'
}

/**
 * Starts a renderer on the canvas. `WebGPURenderer` falls back to WebGL2 by itself, so a failure
 * here means the browser supports neither.
 */
export async function createRenderer(canvas: HTMLCanvasElement): Promise<RendererResult> {
  try {
    const renderer = new WebGPURenderer({ canvas, antialias: true })
    // R3F needs a ready renderer: init() resolves once the backend (or its fallback) is chosen.
    await renderer.init()
    return { ok: true, renderer, backend: detectBackend(renderer) }
  } catch (error) {
    return { ok: false, message: describeFailure(error) }
  }
}
