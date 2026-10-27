// @vitest-environment node
import 'fake-indexeddb/auto'
import { createStore, keys } from 'idb-keyval'
import { describe, expect, it } from 'vitest'

import { getAsset, putAsset } from './asset-store'

/** SHA-256 of the three ASCII bytes "abc", a published test vector. */
const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
const SHA256_HEX_LENGTH = 64

const blobOf = (text: string, type = 'image/png'): Blob => new Blob([text], { type })

describe('asset store', () => {
  it('putAsset keys a file by the lowercase hex SHA-256 of its bytes', async () => {
    const id = await putAsset(blobOf('abc'))

    expect(id).toBe(ABC_SHA256)
    expect(id).toHaveLength(SHA256_HEX_LENGTH)
  })

  it('putAsset dedupes identical bytes', async () => {
    const first = await putAsset(blobOf('same pixels'))
    const second = await putAsset(blobOf('same pixels', 'image/webp'))
    const stored = await keys(createStore('nudo-tsl', 'assets'))

    expect(second).toBe(first)
    expect(stored.filter((key) => key === first)).toHaveLength(1)
  })

  it('putAsset gives different bytes different ids', async () => {
    expect(await putAsset(blobOf('one'))).not.toBe(await putAsset(blobOf('two')))
  })

  it('getAsset returns the stored bytes', async () => {
    const id = await putAsset(blobOf('round trip'))

    const stored = await getAsset(id)

    expect(stored).not.toBeNull()
    expect(await stored?.text()).toBe('round trip')
  })

  it('getAsset returns null for an unknown id', async () => {
    expect(await getAsset('f'.repeat(SHA256_HEX_LENGTH))).toBeNull()
  })
})
