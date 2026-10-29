// @vitest-environment node
import 'fake-indexeddb/auto'
import { createStore, keys } from 'idb-keyval'
import { describe, expect, it, vi } from 'vitest'

import type { TemplateTexture } from '@/examples/template-texture'
import { hashAsset, putAsset } from '@/features/assets/asset-store'
import { createBundledAssets } from '@/features/assets/bundled-assets'

import { createTemplateTextureLoader } from './load-template-textures'
import type { TemplateTextureSources } from './load-template-textures'

const GRAIN: TemplateTexture = { id: 'paper-grain', file: '/grain.png', label: 'Paper grain' }
const BRUSH: TemplateTexture = { id: 'brush', file: '/brush.png', label: 'Brush stroke' }
const FILES: Readonly<Record<string, string>> = { '/grain.png': 'grain', '/brush.png': 'brush' }

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
    fetchAsset: (url) => bundled.fetch(url),
    loadTexture,
    storeAsset,
  }
  return { load: createTemplateTextureLoader(sources), loadTexture, storeAsset }
}

const storedIds = () => keys(createStore('nudo-tsl', 'assets'))

describe('loadTemplateTextures', () => {
  it('opening stores every texture and binds it to its content hash', async () => {
    const { load } = setup()

    const result = await load([GRAIN, BRUSH], 'open')

    const grainId = await hashAsset(new Blob(['grain']))
    expect(result.failed).toEqual([])
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

  it('reports a texture that fails to fetch, decode or store, and binds the rest', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const missing: TemplateTexture = { id: 'gone', file: '/gone.png', label: 'Gone' }
    const brushId = await hashAsset(new Blob(['brush']))
    const undecodable = setup({ loadTexture: (id) => Promise.resolve(id !== brushId) })
    const unstorable = setup({ storeAsset: () => Promise.reject(new Error('quota')) })

    const fetched = await undecodable.load([GRAIN, missing, BRUSH], 'open')
    const stored = await unstorable.load([GRAIN], 'open')

    expect(fetched.failed).toEqual([missing, BRUSH])
    expect([...fetched.bindings.keys()]).toEqual(['paper-grain'])
    expect(undecodable.storeAsset).toHaveBeenCalledTimes(1)
    expect(stored.failed).toEqual([GRAIN])
    expect(stored.bindings.size).toBe(0)
  })

  it('has nothing to do for a template without textures', async () => {
    const { load, loadTexture } = setup()

    expect(await load([], 'open')).toEqual({ bindings: new Map(), failed: [] })
    expect(loadTexture).not.toHaveBeenCalled()
  })
})
