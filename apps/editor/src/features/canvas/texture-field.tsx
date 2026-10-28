import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { X } from 'lucide-react'

import {
  ACCEPTED_IMAGES_HINT,
  IMAGE_ACCEPT,
  isAcceptedImage,
} from '@/features/assets/accepted-images'
import { putAsset } from '@/features/assets/asset-store'
import { textureCache } from '@/features/assets/texture-cache'
import {
  textureImageSize,
  textureThumbnailSource,
} from '@/features/assets/texture-thumbnail-source'
import { useTexture } from '@/features/assets/use-texture'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import type { PortExplanation } from './node-explanation'
import { PortLabel } from './port-label'
import { TextureSlot } from './texture-slot'

const SAVE_FAILED_HINT = 'Could not save this image.'
const UNREADABLE_HINT = "Couldn't read this image."
const REMOVE_LABEL = 'Remove image'

export interface TextureFieldProps {
  /** Names the input in the slot's and remove button's accessible names. */
  label: string
  /** The text shown beside the slot, when it differs from `label`. */
  visibleLabel?: string
  /** What the input means, shown when its label is hovered. */
  explanation?: PortExplanation | undefined
  /** The chosen asset, or `null` while no image is chosen. */
  assetId: string | null
  /** Called with the id of the image the person just chose, or `null` when they removed it. */
  onChange: (assetId: string | null) => void
}

/**
 * Picks the image of an unconnected texture input, on the same row as its label: a thumbnail slot
 * that opens the file chooser or takes a dropped file, and a remove button once an image is set.
 * The file is stored in IndexedDB under the hash of its bytes, so the graph only carries that id.
 */
export function TextureField({
  label,
  visibleLabel = label,
  explanation,
  assetId,
  onChange,
}: TextureFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const slotRef = useRef<HTMLButtonElement>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const texture = useTexture(assetId)
  // The asset can change while an image is being stored, so saveImage reads it through a ref.
  const currentAssetId = useRef(assetId)
  useEffect(() => {
    currentAssetId.current = assetId
  }, [assetId])

  const isMissing = texture.state === 'missing'
  const source = texture.texture === null ? null : textureThumbnailSource(texture.texture)
  const size = texture.texture === null ? null : textureImageSize(texture.texture)

  const saveImage = async (file: Blob): Promise<void> => {
    try {
      const chosenId = await putAsset(file)
      // Decoded before the graph changes, so the preview builds once with the image in place.
      await textureCache.reload(chosenId)
      // The bytes are stored, so an image that did not load could not be decoded: keep the old one.
      if (textureCache.getSnapshot(chosenId).state !== 'ready') {
        setProblem(UNREADABLE_HINT)
        return
      }
      if (chosenId !== currentAssetId.current) onChange(chosenId)
    } catch (error) {
      console.warn('Could not store the chosen image:', error)
      setProblem(SAVE_FAILED_HINT)
    }
  }

  const takeFile = (file: File | undefined): void => {
    if (file === undefined) return
    if (!isAcceptedImage(file)) {
      setProblem(ACCEPTED_IMAGES_HINT)
      return
    }
    setProblem(null)
    void saveImage(file)
  }

  const onFileChosen = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.currentTarget
    const [file] = input.files ?? []
    // Cleared so choosing the same file again still fires `change`.
    input.value = ''
    takeFile(file)
  }

  const removeImage = (): void => {
    setProblem(null)
    onChange(null)
    // The remove button unmounts with the image, so focus stays in the row on the slot.
    slotRef.current?.focus()
  }

  return (
    <>
      <PortLabel label={visibleLabel} explanation={explanation} />
      <span className="nodrag flex shrink-0 items-center gap-1">
        {/* Always mounted, so "Missing texture" is announced when it appears. */}
        <span role="status" className="font-mono text-micro text-destructive">
          {isMissing && (
            <>
              <span>Missing</span>
              <span className="sr-only"> texture</span>
            </>
          )}
        </span>
        {assetId !== null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                static
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`${REMOVE_LABEL} from ${label}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={removeImage}
              >
                <X aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{REMOVE_LABEL}</TooltipContent>
          </Tooltip>
        )}
        <TextureSlot
          ref={slotRef}
          label={label}
          state={texture.state}
          source={source}
          size={size}
          onChoose={() => {
            fileInputRef.current?.click()
          }}
          onDropFile={takeFile}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={onFileChosen}
        />
      </span>
      {problem !== null && (
        <span role="alert" className="basis-full pb-1.5 pl-3.5 text-micro text-destructive">
          {problem}
        </span>
      )}
    </>
  )
}
