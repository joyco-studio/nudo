import { Mesh, SphereGeometry, getConsoleFunction, setConsoleFunction } from 'three'
import type { Camera, Material, Scene, WebGLRenderer } from 'three'

export type MaterialValidation = { ok: true } | { ok: false; message: string }

type ConsoleFunction = ReturnType<typeof getConsoleFunction>

/** The slice of the renderer that validation needs. */
type CompilingRenderer = Pick<WebGLRenderer, 'compileAsync'>

const PROBE_SEGMENTS = { width: 8, height: 4 } as const
const FALLBACK_MESSAGE = 'The material failed to compile.'
/** A renderer that never answers must not block every later material. */
const COMPILE_TIMEOUT_MS = 10_000

/** What three.js does with its log calls when nobody installed a console function. */
const forwardToConsole: ConsoleFunction = (type, message, ...params) => {
  console[type](message, ...params)
}

/** Typed as possibly missing: three.js has no console function until one is installed. */
const currentConsoleFunction = (): ConsoleFunction | null => getConsoleFunction()

function describeFailure(error: unknown): string {
  return error instanceof Error ? error.message : FALLBACK_MESSAGE
}

/** Runs the task while collecting every error three.js logs, still printing them as usual. */
async function collectingErrors(task: () => Promise<unknown>): Promise<string[]> {
  const previous = currentConsoleFunction() ?? forwardToConsole
  const errors: string[] = []
  setConsoleFunction((type, message, ...params) => {
    if (type === 'error') errors.push(message)
    previous(type, message, ...params)
  })
  try {
    await task()
    return errors
  } finally {
    setConsoleFunction(previous)
  }
}

/** Compilations share the global console function, so they run one at a time. */
let queue: Promise<unknown> = Promise.resolve()

function runOneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task)
  queue = result.catch(() => undefined)
  return result
}

/** Resolves `fallback` when the task takes longer than `timeoutMs`. */
async function withTimeout<T>(task: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(fallback)
    }, timeoutMs)
  })
  try {
    return await Promise.race([task, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * TSL nodes are lazy: some mistakes only surface when the renderer builds the shader. This
 * compiles the material on a throwaway mesh, against the real scene's lights, so a broken one is
 * caught before it replaces the working material. Never throws. A compile that never finishes is
 * let through: the check is a safeguard, not a gate that can freeze the preview.
 */
export function validateMaterial(
  renderer: CompilingRenderer,
  scene: Scene,
  camera: Camera,
  material: Material,
): Promise<MaterialValidation> {
  return runOneAtATime(async () => {
    const geometry = new SphereGeometry(1, PROBE_SEGMENTS.width, PROBE_SEGMENTS.height)
    const probe = new Mesh(geometry, material)
    try {
      const compiled = collectingErrors(() => renderer.compileAsync(probe, camera, scene))
      const errors = await withTimeout(compiled, COMPILE_TIMEOUT_MS, [])
      const [firstError] = errors
      return firstError === undefined ? { ok: true } : { ok: false, message: firstError }
    } catch (error) {
      return { ok: false, message: describeFailure(error) }
    } finally {
      geometry.dispose()
    }
  })
}
