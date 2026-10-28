import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { X } from 'lucide-react'

import { IMAGE_ACCEPT, isAcceptedImage } from '@/features/assets/accepted-images'
import { putAsset } from '@/features/assets/asset-store'
import { textureCache } from '@/features/assets/texture-cache'
import {
  textureImageSize,
  textureThumbnailSource,
} from '@/features/assets/texture-thumbnail-source'
import { useTexture } from '@/features/assets/use-texture'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import type { MessageKey } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'

import { PortLabel } from './port-label'
import { TextureSlot } from './texture-slot'

export interface TextureFieldProps {
  /** Names the input in the slot's and remove button's accessible names. */
  label: string
  /** The text shown beside the slot, when it differs from `label`. */
  visibleLabel?: string
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
  assetId,
  onChange,
}: TextureFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const slotRef = useRef<HTMLButtonElement>(null)
  /** Why the last image was not taken, shown under the row. */
  const [problem, setProblem] = useState<MessageKey | null>(null)
  const t = useT()
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
        setProblem('texture.unreadable')
        return
      }
      if (chosenId !== currentAssetId.current) onChange(chosenId)
    } catch (error) {
      console.warn('Could not store the chosen image:', error)
      setProblem('texture.saveFailed')
    }
  }

  const takeFile = (file: File | undefined): void => {
    if (file === undefined) return
    if (!isAcceptedImage(file)) {
      setProblem('texture.accepted')
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
      <PortLabel label={visibleLabel} />
      <span className="nodrag flex shrink-0 items-center gap-1">
        {/* Always mounted, so "Missing texture" is announced when it appears. */}
        <span role="status" className="font-mono text-micro text-destructive">
          {isMissing && (
            <>
              <span>{t('texture.missing')}</span>
              <span className="sr-only"> {t('texture.missingDetail')}</span>
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
                aria-label={t('texture.removeFrom', { port: label })}
                className="text-muted-foreground hover:text-foreground"
                onClick={removeImage}
              >
                <X aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t('texture.remove')}</TooltipContent>
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
          {t(problem)}
        </span>
      )}
    </>
  )
}
