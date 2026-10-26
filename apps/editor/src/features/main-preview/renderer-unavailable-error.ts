/** Thrown by the canvas's renderer factory when the browser supports neither WebGPU nor WebGL2. */
export class RendererUnavailableError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'RendererUnavailableError'
  }
}
