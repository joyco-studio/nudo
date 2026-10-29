// @vitest-environment node
import 'fake-indexeddb/auto'
import { createStore, keys } from 'idb-keyval'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TemplateTexture } from '@/examples/template-texture'
import { hashAsset, putAsset } from '@/features/assets/asset-store'
import { createBundledAssets } from '@/features/assets/bundled-assets'

import { createTemplateTextureLoader } from './load-template-textures'
import type { TemplateTextureSources } from './load-template-textures'

const GRAIN: TemplateTexture = {
  id: 'paper-grain',
  file: '/grain.png',
  label: 'templateTexture.paper-grain',
}
const BRUSH: TemplateTexture = {
  id: 'brush',
  file: '/brush.png',
  label: 'templateTexture.paper-grain',
}
const FILES: Readonly<Record<string, string>> = { '/grain.png': 'grain', '/brush.png': 'brush' }

const TIMEOUT_MS = 10_000

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function setup(overrides: Partial<TemplateTextureSources> = {}) {
  const bundled = createBundledAssets({
    fetchFile: (url) => {
      const bytes = FILES[url]
      return bytes === undefined
        ? Promise.reject(new Error(`404 ${url}`))
        : Promise.resolve(new Blob([bytes]))
    },
    hash: hashAsset,
  })
  const loadTexture = vi.fn(overrides.loadTexture ?? (() => Promise.resolve(true)))
  const storeAsset = vi.fn(overrides.storeAsset ?? putAsset)
  const sources: TemplateTextureSources = {
    fetchAsset: overrides.fetchAsset ?? ((url) => bundled.fetch(url)),
    loadTexture,
    storeAsset,
  }
  return { load: createTemplateTextureLoader(sources, TIMEOUT_MS), loadTexture, storeAsset }
}

const storedIds = () => keys(createStore('nudo-tsl', 'assets'))

describe('loadTemplateTextures', () => {
  it('opening stores every texture and binds it to its content hash', async () => {
    const { load } = setup()

    const result = await load([GRAIN, BRUSH], 'open')

    const grainId = await hashAsset(new Blob(['grain']))
    expect(result.failed).toEqual([])
    expect(result.unsaved).toEqual([])
    expect(result.bindings.get('paper-grain')).toBe(grainId)
    expect(result.bindings.get('brush')).toBe(await hashAsset(new Blob(['brush'])))
    expect(await storedIds()).toContain(grainId)
  })

  it('opening the same template twice keeps one copy of each texture', async () => {
    const { load } = setup()

    const first = await load([GRAIN], 'open')
    const before = (await storedIds()).length
    const second = await load([GRAIN], 'open')

    expect(second.bindings).toEqual(first.bindings)
    expect(await storedIds()).toHaveLength(before)
  })

  it('a preview decodes the textures and binds them without storing anything', async () => {
    const { load, loadTexture, storeAsset } = setup()

    const result = await load([BRUSH], 'preview')

    const brushId = await hashAsset(new Blob(['brush']))
    expect(result.bindings.get('brush')).toBe(brushId)
    expect(loadTexture).toHaveBeenCalledWith(brushId)
    expect(storeAsset).not.toHaveBeenCalled()
  })

  it('reports a texture that fails to fetch or decode, and binds the rest', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const missing: TemplateTexture = {
      id: 'gone',
      file: '/gone.png',
      label: 'templateTexture.paper-grain',
    }
    const brushId = await hashAsset(new Blob(['brush']))
    const undecodable = setup({ loadTexture: (id) => Promise.resolve(id !== brushId) })

    const result = await undecodable.load([GRAIN, missing, BRUSH], 'open')

    expect(result.failed).toEqual([missing, BRUSH])
    expect([...result.bindings.keys()]).toEqual(['paper-grain'])
    expect(undecodable.storeAsset).toHaveBeenCalledTimes(1)
  })

  it('binds a texture it could not store to the in-memory asset, and reports it unsaved', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const unstorable = setup({ storeAsset: () => Promise.reject(new Error('quota')) })

    const result = await unstorable.load([GRAIN], 'open')

    expect(result.failed).toEqual([])
    expect(result.unsaved).toEqual([GRAIN])
    expect(result.bindings.get('paper-grain')).toBe(await hashAsset(new Blob(['grain'])))
  })

  it('gives up on a texture that takes too long, and stores nothing for it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    const { load, storeAsset } = setup({ fetchAsset: () => new Promise(() => undefined) })

    const pending = load([GRAIN], 'open')
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1)
    let isSettled = false
    void pending.then(() => {
      isSettled = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(isSettled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(await pending).toEqual({ bindings: new Map(), failed: [GRAIN], unsaved: [] })
    expect(storeAsset).not.toHaveBeenCalled()
  })

  it('has nothing to do for a template without textures', async () => {
    const { load, loadTexture } = setup()

    expect(await load([], 'open')).toEqual({ bindings: new Map(), failed: [], unsaved: [] })
    expect(loadTexture).not.toHaveBeenCalled()
  })
})
