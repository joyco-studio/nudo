import { useState, useSyncExternalStore } from 'react'

import { ColorPicker } from '@/shared/components/color-picker/color-picker'
import {
  hexToSrgb,
  linearToSrgb,
  srgbToHex,
  srgbToLinear,
} from '@/shared/components/color-picker/color-math'
import type { Rgb } from '@/shared/components/color-picker/color-math'

import { getThemeBackgroundHex, subscribeToThemeBackground } from './theme-background'

export interface BackgroundColor {
  /** What the viewport shows: the color being picked, else the committed one. */
  shown: string
  /** The theme's background, until the user commits their own color. */
  committed: string
  preview: (hex: string) => void
  commit: (hex: string) => void
  cancel: () => void
}

/** The viewport background as `#rrggbb`. Picking previews live; it is not saved with the graph. */
export function useBackgroundColor(): BackgroundColor {
  const themeColor = useSyncExternalStore(subscribeToThemeBackground, getThemeBackgroundHex)
  const [customColor, setCustomColor] = useState<string | null>(null)
  const [previewColor, setPreviewColor] = useState<string | null>(null)
  const committed = customColor ?? themeColor

  return {
    shown: previewColor ?? committed,
    committed,
    preview: setPreviewColor,
    commit: (hex) => {
      setPreviewColor(null)
      // An unchanged pick keeps following the theme.
      if (hex !== committed) setCustomColor(hex)
    },
    cancel: () => {
      setPreviewColor(null)
    },
  }
}

const BLACK: Rgb = [0, 0, 0]
const hexToLinear = (hex: string): Rgb => srgbToLinear(hexToSrgb(hex) ?? BLACK)
const linearToHex = (linear: Rgb): string => srgbToHex(linearToSrgb(linear))

export function BackgroundColorField({ color }: { color: BackgroundColor }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Background</span>
      <ColorPicker
        label="Background color"
        value={hexToLinear(color.committed)}
        onPreview={(linear) => {
          color.preview(linearToHex(linear))
        }}
        onCommit={(linear) => {
          color.commit(linearToHex(linear))
        }}
        onCancel={color.cancel}
      />
    </div>
  )
}
