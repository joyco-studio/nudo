import { MeshBasicMaterial, PerspectiveCamera, Scene, error as logThreeError } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { validateMaterial } from './validate-material'

const COMPILE_TIMEOUT_MS = 10_000

const material = new MeshBasicMaterial()
const scene = new Scene()
const camera = new PerspectiveCamera()

type Compile = () => Promise<unknown>

const validateWith = (compile: Compile) =>
  validateMaterial(
    { compileAsync: vi.fn(() => compile().then(() => scene)) },
    scene,
    camera,
    material,
  )

describe('validateMaterial', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('accepts a material the renderer compiles quietly', async () => {
    await expect(validateWith(() => Promise.resolve())).resolves.toEqual({ ok: true })
  })

  it('rejects a material whose compile throws, with the reason', async () => {
    const result = await validateWith(() => Promise.reject(new Error('node graph exploded')))

    expect(result).toEqual({ ok: false, message: 'node graph exploded' })
  })

  it('rejects a material when three.js logs an error while compiling', async () => {
    const result = await validateWith(() => {
      logThreeError('TSL: bad node')
      return Promise.resolve()
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? '' : result.message).toContain('TSL: bad node')
  })

  it('does not blame a material for errors logged outside its compile', async () => {
    await validateWith(() => Promise.resolve())
    logThreeError('unrelated problem')

    await expect(validateWith(() => Promise.resolve())).resolves.toEqual({ ok: true })
  })

  it('compiles one material at a time', async () => {
    const order: string[] = []
    const slow = validateWith(async () => {
      order.push('first:start')
      await Promise.resolve()
      order.push('first:end')
    })
    const fast = validateWith(() => {
      order.push('second:start')
      return Promise.resolve()
    })

    await Promise.all([slow, fast])

    expect(order).toEqual(['first:start', 'first:end', 'second:start'])
  })

  it('skips a queued validation that was cancelled before its turn', async () => {
    const compileAsync = vi.fn(() => Promise.resolve(scene))
    let isCancelled = false
    const first = validateMaterial({ compileAsync }, scene, camera, material)
    const second = validateMaterial({ compileAsync }, scene, camera, material, () => isCancelled)
    isCancelled = true

    const [, skipped] = await Promise.all([first, second])

    expect(compileAsync).toHaveBeenCalledOnce()
    expect(skipped.ok).toBe(false)
  })

  it('lets a compile that never finishes through, so it cannot freeze the preview', async () => {
    vi.useFakeTimers()
    const pending = validateWith(() => new Promise(() => undefined))

    await vi.advanceTimersByTimeAsync(COMPILE_TIMEOUT_MS)

    await expect(pending).resolves.toEqual({ ok: true })
  })
})
