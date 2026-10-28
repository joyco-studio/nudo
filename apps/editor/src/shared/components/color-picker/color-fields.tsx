import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Pipette } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import type { MessageKey } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'

import { fromByte, hexToSrgb, srgbToHex, toByte } from './color-math'
import type { Rgb } from './color-math'
import { hasEyeDropper, pickScreenColor } from './eye-dropper'

const BYTE_MAX = 255
const BYTE_PATTERN = /^\d{1,3}$/
const ARROW_STEP = 1
const SHIFT_ARROW_STEP = 10

const CHANNELS: readonly { readonly label: string; readonly name: MessageKey }[] = [
  { label: 'R', name: 'color.red' },
  { label: 'G', name: 'color.green' },
  { label: 'B', name: 'color.blue' },
]

const FIELD_CLASS =
  'h-6 min-w-0 border-border bg-background px-1 py-0 font-mono text-base tabular-nums text-foreground hover:border-muted-foreground aria-invalid:ring-0 md:text-field dark:bg-background'
const INVALID_FIELD_CLASS = 'border-destructive text-destructive hover:border-destructive'
const LABEL_CLASS = 'shrink-0 font-mono text-micro font-normal text-muted-foreground uppercase'

function parseByte(text: string): number | null {
  const trimmed = text.trim()
  if (!BYTE_PATTERN.test(trimmed)) return null
  const byte = Number(trimmed)
  return byte <= BYTE_MAX ? byte : null
}

/** `#` is optional while typing. */
function parseHex(text: string): Rgb | null {
  const trimmed = text.trim()
  return hexToSrgb(trimmed.startsWith('#') ? trimmed : `#${trimmed}`)
}

const withChannel = (srgb: Rgb, index: number, channel: number): Rgb => [
  index === 0 ? channel : srgb[0],
  index === 1 ? channel : srgb[1],
  index === 2 ? channel : srgb[2],
]

interface DraftTextField {
  text: string
  isInvalid: boolean
  onTextChange: (text: string) => void
  /** Drops the draft, so the field shows the color again (text that did not parse reverts). */
  reset: () => void
}

/** A text field that edits live: every draft that parses is applied as it is typed. */
function useDraftText<T>(
  shownText: string,
  parse: (text: string) => T | null,
  apply: (value: T) => void,
): DraftTextField {
  const [draftText, setDraftText] = useState<string | null>(null)
  return {
    text: draftText ?? shownText,
    isInvalid: draftText !== null && parse(draftText) === null,
    onTextChange: (text) => {
      setDraftText(text)
      const parsed = parse(text)
      if (parsed !== null) apply(parsed)
    },
    reset: () => {
      setDraftText(null)
    },
  }
}

interface HexFieldProps {
  srgb: Rgb
  onChange: (srgb: Rgb) => void
}

function HexField({ srgb, onChange }: HexFieldProps) {
  const inputId = useId()
  const field = useDraftText(srgbToHex(srgb), parseHex, onChange)
  const t = useT()

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={inputId} className={cn(LABEL_CLASS, 'w-6')}>
        {t('color.hex')}
      </Label>
      <Input
        id={inputId}
        type="text"
        autoComplete="off"
        spellCheck={false}
        aria-label={t('color.hex')}
        aria-invalid={field.isInvalid}
        value={field.text}
        onChange={(event) => {
          field.onTextChange(event.target.value)
        }}
        onBlur={field.reset}
        className={cn(FIELD_CLASS, 'flex-1', field.isInvalid && INVALID_FIELD_CLASS)}
      />
    </div>
  )
}

interface ChannelFieldProps {
  label: string
  name: MessageKey
  byte: number
  onChange: (byte: number) => void
}

/** One 0..255 channel. ArrowUp/Down step by 1 (Shift: 10). */
function ChannelField({ label, name, byte, onChange }: ChannelFieldProps) {
  const inputId = useId()
  const field = useDraftText(String(byte), parseByte, onChange)
  const t = useT()

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const step =
      (event.shiftKey ? SHIFT_ARROW_STEP : ARROW_STEP) * (event.key === 'ArrowUp' ? 1 : -1)
    field.reset()
    onChange(Math.min(BYTE_MAX, Math.max(0, byte + step)))
  }

  return (
    <div className="flex min-w-0 flex-1 basis-0 items-center gap-1">
      <Label htmlFor={inputId} className={cn(LABEL_CLASS, 'w-2.5')}>
        {label}
      </Label>
      <Input
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        aria-label={t(name)}
        aria-invalid={field.isInvalid}
        value={field.text}
        onChange={(event) => {
          field.onTextChange(event.target.value)
        }}
        onBlur={field.reset}
        onKeyDown={onKeyDown}
        className={cn(FIELD_CLASS, 'w-full text-right', field.isInvalid && INVALID_FIELD_CLASS)}
      />
    </div>
  )
}

function EyeDropperButton({ onPick }: { onPick: (srgb: Rgb) => void }) {
  const isMountedRef = useRef(false)
  const t = useT()

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const pick = async (): Promise<void> => {
    const hex = await pickScreenColor()
    // The picker may have closed while the eyedropper was open.
    if (hex === null || !isMountedRef.current) return
    const srgb = hexToSrgb(hex)
    if (srgb !== null) onPick(srgb)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          static
          variant="ghost"
          size="icon-xs"
          aria-label={t('color.pickFromScreen')}
          onClick={() => {
            void pick()
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          <Pipette aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" aria-hidden="true">
        {t('color.pickFromScreen')}
      </TooltipContent>
    </Tooltip>
  )
}

interface ColorFieldsProps {
  srgb: Rgb
  onChange: (srgb: Rgb) => void
}

/** Exact entry: the hex code, the three 0..255 channels and, where supported, an eyedropper. */
export function ColorFields({ srgb, onChange }: ColorFieldsProps) {
  const [canPickFromScreen] = useState(hasEyeDropper)

  return (
    <div className="flex flex-col gap-2">
      <HexField srgb={srgb} onChange={onChange} />
      <div className="flex items-center gap-2">
        {CHANNELS.map((channel, index) => (
          <ChannelField
            key={channel.name}
            label={channel.label}
            name={channel.name}
            byte={toByte(srgb[index] ?? 0)}
            onChange={(byte) => {
              onChange(withChannel(srgb, index, fromByte(byte)))
            }}
          />
        ))}
        {canPickFromScreen && <EyeDropperButton onPick={onChange} />}
      </div>
    </div>
  )
}
