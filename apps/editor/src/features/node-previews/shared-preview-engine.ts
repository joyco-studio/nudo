import { createPreviewMaterial } from '@nudo-tsl/runtime'

import { textureCache } from '@/features/assets/texture-cache'
import { createRenderer } from '@/features/main-preview/create-renderer'
import { registry } from '@/store/registry'

import { createPreviewEngine } from './preview-engine'
import type { PreviewEngine } from './preview-engine'
import { recordNodePreviewRender } from './preview-stats'

/** CSS pixels per side of a node preview. */
export const NODE_PREVIEW_SIZE = 96
/** Animated (Time) previews redraw at most this often, and only while on screen. */
const NODE_PREVIEW_FPS = 20
/** Most previews built or drawn in one animation frame, so a big graph never stalls a frame. */
const NODE_PREVIEW_BUDGET_PER_FRAME = 4
/** Sharper on high-density screens, but never more than twice the pixels per side. */
const MAX_PIXEL_RATIO = 2

/** The pixel ratio previews render at: the screen's, capped. */
export const nodePreviewPixelRatio = (): number =>
  Math.min(globalThis.devicePixelRatio || 1, MAX_PIXEL_RATIO)

let sharedEngine: PreviewEngine | null = null

/**
 * The one preview engine of the page, created on first use. It lives as long as the page, like the
 * texture cache, and its renderer only starts once a node registers a preview.
 */
export function getSharedPreviewEngine(): PreviewEngine {
  sharedEngine ??= createPreviewEngine({
    size: NODE_PREVIEW_SIZE,
    fps: NODE_PREVIEW_FPS,
    budgetPerFrame: NODE_PREVIEW_BUDGET_PER_FRAME,
    // Its own hidden canvas: each frame is copied onto the node's canvas.
    createRenderer: () => createRenderer(document.createElement('canvas')),
    pixelRatio: nodePreviewPixelRatio(),
    registry,
    // Asking the cache for an asset also starts loading it; the engine builds again once it is in.
    buildMaterial: (graph, ref) =>
      createPreviewMaterial(graph, registry, ref, {
        resolveTexture: (assetId) => textureCache.peek(assetId),
      }),
    onRendered: recordNodePreviewRender,
  })
  return sharedEngine
}
