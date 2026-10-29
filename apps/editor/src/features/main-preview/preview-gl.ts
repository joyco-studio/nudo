import type { WebGPURenderer } from 'three/webgpu'

import { createRenderer } from './create-renderer'
import type { RendererBackend } from './create-renderer'
import { RendererUnavailableError } from './renderer-unavailable-error'

/** The camera every material preview starts from. */
export const PREVIEW_CAMERA = { position: [0, 0, 3.6], fov: 40 } as const
/** Sharp on high-density screens without paying for 3x. */
export const MAX_PREVIEW_PIXEL_RATIO = 2

export interface PreviewRenderer {
  readonly renderer: WebGPURenderer
  readonly backend: RendererBackend
}

/**
 * The renderer factory for a preview `<Canvas gl>`. R3F reports a factory that throws by throwing
 * during render, so a browser with neither WebGPU nor WebGL2 reaches the preview's error boundary
 * as a `RendererUnavailableError`.
 */
export async function startPreviewRenderer(
  canvas: HTMLCanvasElement | EventTarget,
): Promise<PreviewRenderer> {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new RendererUnavailableError('The preview needs an HTML canvas element.')
  }
  const result = await createRenderer(canvas)
  if (!result.ok) throw new RendererUnavailableError(result.message)
  return { renderer: result.renderer, backend: result.backend }
}
