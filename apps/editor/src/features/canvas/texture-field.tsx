import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ImageOff, ImagePlus, TriangleAlert } from 'lucide-react'

import {
  ACCEPTED_IMAGES_HINT,
  IMAGE_ACCEPT,
  isAcceptedImage,
} from '@/features/assets/accepted-images'
import { putAsset } from '@/features/assets/asset-store'
import { textureCache } from '@/features/assets/texture-cache'
import { textureThumbnailSource } from '@/features/assets/texture-thumbnail-source'
import { useTexture } from '@/features/assets/use-texture'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

import { PortLabel } from './inline-field'

const SAVE_FAILED_HINT = 'Could not save this image.'

export interface TextureFieldProps {
  label: string
  /** The chosen asset, or `null` while no image is chosen. */
  assetId: string | null
  /** Called with the id of the image the person just chose. */
  onChange: (assetId: string) => void
}

/** A decorative 32px preview; the state is also said in text next to it. */
function Thumbnail({ source }: { source: string | null }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted text-muted-foreground">
      {source === null ? (
        <ImageOff aria-hidden="true" className="size-3.5" />
      ) : (
        <img src={source} alt="" className="size-full object-cover" />
      )}
    </span>
  )
}

/**
 * Picks the image of an unconnected texture input. The file is stored in IndexedDB under the hash
 * of its bytes, so the graph only carries that id. The visually hidden file input is opened by the
 * button, which is the only tab stop.
 */
export function TextureField({ label, assetId, onChange }: TextureFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const texture = useTexture(assetId)

  const isMissing = texture.state === 'missing'
  const buttonText = assetId === null || isMissing ? 'Choose image' : 'Change image'
  const thumbnailSource = texture.texture === null ? null : textureThumbnailSource(texture.texture)

  const saveImage = async (file: Blob): Promise<void> => {
    try {
      const chosenId = await putAsset(file)
      // Decoded before the graph changes, so the preview builds once with the image in place.
      await textureCache.reload(chosenId)
      if (chosenId !== assetId) onChange(chosenId)
    } catch (error) {
      console.warn('Could not store the chosen image:', error)
      setProblem(SAVE_FAILED_HINT)
    }
  }

  const onFileChosen = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.currentTarget
    const [file] = input.files ?? []
    // Cleared so choosing the same file again still fires `change`.
    input.value = ''
    if (file === undefined) return
    if (!isAcceptedImage(file)) {
      setProblem(ACCEPTED_IMAGES_HINT)
      return
    }
    setProblem(null)
    void saveImage(file)
  }

  return (
    <>
      <PortLabel label={label} />
      <div className="nodrag flex basis-full items-center gap-2 pb-1.5 pl-3.5">
        <Thumbnail source={thumbnailSource} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-field has-[>svg]:px-2"
            aria-label={`${buttonText} for ${label}`}
            onClick={() => {
              fileInputRef.current?.click()
            }}
          >
            <ImagePlus aria-hidden="true" className="size-3" />
            {buttonText}
          </Button>
          {isMissing && (
            <Badge
              variant="destructive"
              role="status"
              className="h-6 gap-1 border-destructive/40 px-2"
            >
              <TriangleAlert aria-hidden="true" />
              Missing texture
            </Badge>
          )}
          {problem !== null && (
            <span role="alert" className="text-micro text-destructive">
              {problem}
            </span>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={onFileChosen}
        />
      </div>
    </>
  )
}
