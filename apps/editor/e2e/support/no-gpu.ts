import type { Page } from '@playwright/test'

/**
 * Makes the page a browser with neither WebGPU nor WebGL2 (nor WebGL): no `navigator.gpu`, and
 * every 3D context a canvas asks for comes back null. 2D canvases keep working.
 */
export async function disableGpuContexts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true })
    // eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied with the canvas as `this` below
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      writable: true,
      value(this: HTMLCanvasElement, contextId: string, ...rest: unknown[]): unknown {
        if (contextId === 'webgl2' || contextId === 'webgl' || contextId === 'webgpu') return null
        const context: unknown = Reflect.apply(originalGetContext, this, [contextId, ...rest])
        return context
      },
    })
  })
}
