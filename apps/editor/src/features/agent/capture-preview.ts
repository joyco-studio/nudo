import { MAX_MESSAGE_BYTES } from '@nudo-tsl/agent-protocol'
import type { AgentError } from '@nudo-tsl/agent-protocol'
import { err, ok } from '@nudo-tsl/core'
import type { Result } from '@nudo-tsl/core'

/** The long side of the image the agent receives, in pixels, when it fits as a PNG. */
export const MAX_PREVIEW_CAPTURE_PX = 512

/** Room in the bridge message for everything around the image data (the response envelope). */
const RESPONSE_ENVELOPE_RESERVE_BYTES = 4_096

/** The longest base64 string that still fits, with its envelope, in one bridge message. */
export const MAX_PREVIEW_DATA_CHARS = MAX_MESSAGE_BYTES - RESPONSE_ENVELOPE_RESERVE_BYTES

const BASE64_CHUNK_BYTES = 0x8000
const BASE64_GROUP_BYTES = 3
const BASE64_GROUP_CHARS = 4

const PREVIEW_MIME_TYPES = ['image/png', 'image/webp', 'image/jpeg'] as const

export type PreviewMimeType = (typeof PREVIEW_MIME_TYPES)[number]

export interface PreviewEncoding {
  readonly maxSide: number
  readonly mimeType: PreviewMimeType
  /** 0 to 1, for the lossy types. */
  readonly quality?: number
}

/**
 * Tried in order until one fits in a message: a lossless PNG first, then lossy and smaller ones
 * for a noisy preview that barely compresses.
 */
export const PREVIEW_ENCODINGS: readonly PreviewEncoding[] = [
  { maxSide: MAX_PREVIEW_CAPTURE_PX, mimeType: 'image/png' },
  { maxSide: MAX_PREVIEW_CAPTURE_PX, mimeType: 'image/webp', quality: 0.85 },
  { maxSide: MAX_PREVIEW_CAPTURE_PX, mimeType: 'image/jpeg', quality: 0.85 },
  { maxSide: 384, mimeType: 'image/jpeg', quality: 0.75 },
  { maxSide: 256, mimeType: 'image/jpeg', quality: 0.7 },
]

/** Renders the preview and encodes it as asked (the browser may fall back to another type). */
export type PreviewCapture = (encoding: PreviewEncoding) => Promise<Blob>

export interface PreviewImage {
  mimeType: PreviewMimeType
  data: string
}

const TOO_LARGE_MESSAGE =
  'The preview image is too large to send, even downscaled and compressed. Read the graph instead.'

let registeredCapture: PreviewCapture | null = null

/** The mounted preview registers how to read its canvas; `null` unregisters it. */
export function setPreviewCapture(capture: PreviewCapture | null): void {
  registeredCapture = capture
}

export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

const isPreviewMimeType = (type: string): type is PreviewMimeType =>
  PREVIEW_MIME_TYPES.some((allowed) => allowed === type)

const base64Length = (byteLength: number): number =>
  Math.ceil(byteLength / BASE64_GROUP_BYTES) * BASE64_GROUP_CHARS

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(start, start + BASE64_CHUNK_BYTES))
  }
  return btoa(binary)
}

/** The first encoding that fits in a message, or null when none does. */
async function encodeToFit(capture: PreviewCapture): Promise<PreviewImage | null> {
  for (const encoding of PREVIEW_ENCODINGS) {
    const blob = await capture(encoding)
    if (!isPreviewMimeType(blob.type)) continue
    if (base64Length(blob.size) > MAX_PREVIEW_DATA_CHARS) continue
    return { mimeType: blob.type, data: await toBase64(blob) }
  }
  return null
}

export async function capturePreview(): Promise<Result<PreviewImage, AgentError>> {
  if (registeredCapture === null) {
    return err({ code: 'not_found', message: 'The preview is hidden or not ready' })
  }
  try {
    const image = await encodeToFit(registeredCapture)
    return image === null ? err({ code: 'invalid', message: TOO_LARGE_MESSAGE }) : ok(image)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error'
    return err({ code: 'invalid', message: `The preview could not be captured: ${reason}` })
  }
}
