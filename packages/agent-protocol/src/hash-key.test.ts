import { expect, it } from 'vitest'
import { hashKey } from './hash-key'

it('hashes a key to lowercase SHA-256 hex', async () => {
  expect(await hashKey('abc')).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  )
})
