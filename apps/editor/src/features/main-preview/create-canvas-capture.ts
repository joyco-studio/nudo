import { MAX_PREVIEW_CAPTURE_PX, fitWithin } from '@/features/agent/capture-preview'
import type { PreviewCapture } from '@/features/agent/capture-preview'

const PNG_MIME_TYPE = 'image/png'

/**
 * Renders one frame and copies the canvas into a downscaled 2D canvas in the same task, while the
 * frame is still readable (no `preserveDrawingBuffer`; WebGL2 and WebGPU alike).
 */
export function createCanvasCapture(
  source: HTMLCanvasElement,
  renderFrame: () => void,
): PreviewCapture {
  return () => {
    if (source.width === 0 || source.height === 0) {
      return Promise.reject(new Error('The preview canvas has no size yet'))
    }
    renderFrame()
    const { width, height } = fitWithin(source.width, source.height, MAX_PREVIEW_CAPTURE_PX)
    const target = document.createElement('canvas')
    target.width = width
    target.height = height
    const context = target.getContext('2d')
    if (context === null) return Promise.reject(new Error('A 2D canvas is not available'))
    context.drawImage(source, 0, 0, width, height)
    return new Promise<Blob>((resolve, reject) => {
      target.toBlob((blob) => {
        if (blob === null) reject(new Error('The canvas could not be encoded as PNG'))
        else resolve(blob)
      }, PNG_MIME_TYPE)
    })
  }
}
