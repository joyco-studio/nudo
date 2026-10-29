import { describe, expect, it, vi } from 'vitest'

import { createBundledAssets } from './bundled-assets'

const GRAIN_URL = '/src/examples/textures/paper-grain.png'
const GRAIN_BYTES = 'grain pixels'

/** A fake hash that is still a function of the bytes, so equal bytes share an id. */
const hashOf = async (file: Blob): Promise<string> => `hash-of-${await file.text()}`

function setup(fetchFile: (url: string) => Promise<Blob>) {
  const fetchSpy = vi.fn(fetchFile)
  return { assets: createBundledAssets({ fetchFile: fetchSpy, hash: hashOf }), fetchSpy }
}

describe('bundled assets', () => {
  it('fetches a bundled file and keys it by the hash of its bytes', async () => {
    const { assets } = setup(() => Promise.resolve(new Blob([GRAIN_BYTES])))

    const asset = await assets.fetch(GRAIN_URL)

    expect(asset.assetId).toBe(`hash-of-${GRAIN_BYTES}`)
    expect(await asset.file.text()).toBe(GRAIN_BYTES)
  })

  it('holds the file in memory under its id, without storing it', async () => {
    const { assets } = setup(() => Promise.resolve(new Blob([GRAIN_BYTES])))
    expect(assets.file(`hash-of-${GRAIN_BYTES}`)).toBeNull()

    const { assetId } = await assets.fetch(GRAIN_URL)

    expect(await assets.file(assetId)?.text()).toBe(GRAIN_BYTES)
  })

  it('fetches each file once, however often it is asked for', async () => {
    const { assets, fetchSpy } = setup(() => Promise.resolve(new Blob([GRAIN_BYTES])))

    const [first, second] = await Promise.all([assets.fetch(GRAIN_URL), assets.fetch(GRAIN_URL)])
    const third = await assets.fetch(GRAIN_URL)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  it('rejects a failed fetch and tries again on the next request', async () => {
    const { assets, fetchSpy } = setup(() => Promise.resolve(new Blob([GRAIN_BYTES])))
    fetchSpy.mockRejectedValueOnce(new Error('offline'))

    await expect(assets.fetch(GRAIN_URL)).rejects.toThrow('offline')
    const retried = await assets.fetch(GRAIN_URL)

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(retried.assetId).toBe(`hash-of-${GRAIN_BYTES}`)
  })
})
