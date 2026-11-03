import { afterEach, describe, expect, it } from 'vitest'
import { MAX_MESSAGE_BYTES } from '@nudo-tsl/agent-protocol'
import {
  MAX_PREVIEW_DATA_CHARS,
  PREVIEW_ENCODINGS,
  capturePreview,
  fitWithin,
  setPreviewCapture,
} from './capture-preview'
import type { PreviewEncoding } from './capture-preview'

afterEach(() => {
  setPreviewCapture(null)
})

/** Random bytes: what a noisy shader looks like to an image encoder. */
function noise(size: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size)
  const chunk = 65_536
  for (let start = 0; start < size; start += chunk) {
    crypto.getRandomValues(bytes.subarray(start, Math.min(size, start + chunk)))
  }
  return bytes
}

describe('capturePreview', () => {
  it('returns not_found when no capture is registered', async () => {
    const result = await capturePreview()

    expect(result).toEqual({
      ok: false,
      error: { code: 'not_found', message: 'The preview is hidden or not ready' },
    })
  })

  it('returns base64 png data from the registered capture', async () => {
    setPreviewCapture(() => Promise.resolve(new Blob(['png-bytes'], { type: 'image/png' })))

    const result = await capturePreview()

    expect(result).toEqual({
      ok: true,
      value: { mimeType: 'image/png', data: btoa('png-bytes') },
    })
  })

  it('re-encodes a noisy preview whose PNG would not fit in one message', async () => {
    const asked: PreviewEncoding[] = []
    setPreviewCapture((encoding) => {
      asked.push(encoding)
      // Noise barely compresses: a 512px PNG of it is ~786 KB, over 1 MiB once in base64.
      const size = encoding.mimeType === 'image/png' ? 786_000 : 120_000
      return Promise.resolve(new Blob([noise(size)], { type: encoding.mimeType }))
    })

    const result = await capturePreview()

    if (!result.ok) throw new Error(result.error.message)
    expect(asked.map((encoding) => encoding.mimeType)).toEqual(['image/png', 'image/webp'])
    expect(result.value.mimeType).toBe('image/webp')
    expect(result.value.data.length).toBeLessThanOrEqual(MAX_PREVIEW_DATA_CHARS)
    expect(MAX_PREVIEW_DATA_CHARS).toBeLessThan(MAX_MESSAGE_BYTES)
  })

  it('reports the type the browser encoded, when it falls back from WebP', async () => {
    setPreviewCapture((encoding) => {
      const type = encoding.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png'
      const size = type === 'image/png' ? 786_000 : 90_000
      return Promise.resolve(new Blob([noise(size)], { type }))
    })

    const result = await capturePreview()

    expect(result).toMatchObject({ ok: true, value: { mimeType: 'image/jpeg' } })
  })

  it('answers invalid when even the smallest encoding is too large', async () => {
    setPreviewCapture((encoding) =>
      Promise.resolve(new Blob([noise(900_000)], { type: encoding.mimeType })),
    )

    const result = await capturePreview()

    expect(result).toMatchObject({ ok: false, error: { code: 'invalid' } })
    if (result.ok) return
    expect(result.error.message).toContain('too large')
    expect(PREVIEW_ENCODINGS.at(-1)?.maxSide).toBeLessThan(PREVIEW_ENCODINGS[0]?.maxSide ?? 0)
  })

  it('returns an invalid error when the capture fails', async () => {
    setPreviewCapture(() => Promise.reject(new Error('lost context')))

    const result = await capturePreview()

    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid', message: 'The preview could not be captured: lost context' },
    })
  })
})

describe('fitWithin', () => {
  it('keeps a small image as it is', () => {
    expect(fitWithin(200, 100, 512)).toEqual({ width: 200, height: 100 })
  })

  it('scales the long side down to the limit', () => {
    expect(fitWithin(1024, 512, 512)).toEqual({ width: 512, height: 256 })
    expect(fitWithin(300, 900, 512)).toEqual({ width: 171, height: 512 })
  })
})
