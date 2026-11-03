import type { AgentError } from '@nudo-tsl/agent-protocol'
import { err, ok } from '@nudo-tsl/core'
import type { Result } from '@nudo-tsl/core'

/** The long side of the image the agent receives, in pixels. */
export const MAX_PREVIEW_CAPTURE_PX = 512

const BASE64_CHUNK_BYTES = 0x8000

export type PreviewCapture = () => Promise<Blob>

export interface PreviewImage {
  mimeType: 'image/png'
  data: string
}

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

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(start, start + BASE64_CHUNK_BYTES))
  }
  return btoa(binary)
}

export async function capturePreview(): Promise<Result<PreviewImage, AgentError>> {
  if (registeredCapture === null) {
    return err({ code: 'not_found', message: 'The preview is hidden or not ready' })
  }
  try {
    const blob = await registeredCapture()
    return ok({ mimeType: 'image/png', data: await toBase64(blob) })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error'
    return err({ code: 'invalid', message: `The preview could not be captured: ${reason}` })
  }
}
