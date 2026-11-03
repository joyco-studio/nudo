import { afterEach, describe, expect, it } from 'vitest'
import { capturePreview, fitWithin, setPreviewCapture } from './capture-preview'

afterEach(() => {
  setPreviewCapture(null)
})

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
