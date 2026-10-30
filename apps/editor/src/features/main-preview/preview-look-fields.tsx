import { useId } from 'react'
import { useShallow } from 'zustand/react/shallow'

import {
  PREVIEW_ENVIRONMENTS,
  PREVIEW_EXPOSURE_MAX,
  PREVIEW_EXPOSURE_MIN,
  PREVIEW_EXPOSURE_STEP,
  PREVIEW_TONE_MAPPINGS,
} from '@/features/panels/panel-state'
import type { PanelPrefs } from '@/features/panels/panel-state'
import { DisclosureChevron } from '@/shared/components/disclosure-chevron'
import { OptionSelect } from '@/shared/components/option-select'
import { Label } from '@/shared/ui/label'
import { Slider } from '@/shared/ui/slider'
import { useEditorStore } from '@/store/editor-store'
import { useT } from '@/i18n/use-t'

export type PreviewLookPrefs = Pick<PanelPrefs, 'toneMapping' | 'exposure' | 'environment'>

/** The preview's look, read from the panel preferences: the main preview and the templates share it. */
export function usePreviewLook(): PreviewLookPrefs {
  return useEditorStore(
    useShallow((state) => ({
      toneMapping: state.panels.toneMapping,
      exposure: state.panels.exposure,
      environment: state.panels.environment,
    })),
  )
}

/** Exposure as the field shows it: two decimals, × for a multiplier. */
const formatExposure = (exposure: number): string => `${exposure.toFixed(2)}×`

/** The exposure that changes nothing. */
const DEFAULT_EXPOSURE = 1

const LABEL_CLASS = 'text-xs font-normal text-muted-foreground'

interface PreviewLookToggleProps {
  readonly isOpen: boolean
  /** The id of the fields it shows and hides. */
  readonly controls: string
  readonly onToggle: () => void
}

/**
 * The preview's look, folded into one line beside the backdrop: it says the current tone mapping,
 * environment and exposure, and opens their fields. Folded by default, so the viewport keeps its
 * height in split and full layouts.
 */
export function PreviewLookToggle({ isOpen, controls, onToggle }: PreviewLookToggleProps) {
  const { toneMapping, exposure, environment } = usePreviewLook()
  const t = useT()
  // The exposure joins the line only once it moves off 1, so the folded row stays short.
  const summary = [
    t(`preview.toneMapping.${toneMapping}`),
    t(`preview.environment.${environment}`),
    ...(exposure === DEFAULT_EXPOSURE ? [] : [formatExposure(exposure)]),
  ].join(' · ')

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls={controls}
      onClick={onToggle}
      className="flex min-w-0 cursor-pointer items-center gap-2 text-left text-xs text-muted-foreground outline-none transition-[color,box-shadow] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span>{t('preview.look')}</span>
      <span className="truncate font-mono tabular-nums">{summary}</span>
      <DisclosureChevron isOpen={isOpen} className="size-3.5 shrink-0" />
    </button>
  )
}

interface PreviewLookPanelProps {
  readonly id: string
  readonly isOpen: boolean
}

/**
 * The preview's look fields: the tone mapping that rolls bright light off into white, the
 * environment lit materials reflect, and the exposure before the tone mapping. Persisted with the
 * panel preferences; the templates browser shows its previews with the same look.
 */
export function PreviewLookPanel({ id, isOpen }: PreviewLookPanelProps) {
  const { toneMapping, exposure, environment } = usePreviewLook()
  const toneMappingId = useId()
  const exposureId = useId()
  const environmentId = useId()
  const t = useT()

  return (
    <div id={id} hidden={!isOpen} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={toneMappingId} className={LABEL_CLASS}>
            {t('preview.toneMapping')}
          </Label>
          <OptionSelect
            id={toneMappingId}
            value={toneMapping}
            options={PREVIEW_TONE_MAPPINGS.map((value) => ({
              value,
              label: t(`preview.toneMapping.${value}`),
            }))}
            onValueChange={(next) => {
              useEditorStore.getState().setPreviewToneMapping(next)
            }}
            className="w-28"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={environmentId} className={LABEL_CLASS}>
            {t('preview.environment')}
          </Label>
          <OptionSelect
            id={environmentId}
            value={environment}
            options={PREVIEW_ENVIRONMENTS.map((value) => ({
              value,
              label: t(`preview.environment.${value}`),
            }))}
            onValueChange={(next) => {
              useEditorStore.getState().setPreviewEnvironment(next)
            }}
            className="w-28"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Label id={exposureId} className={LABEL_CLASS}>
          {t('preview.exposure')}
        </Label>
        <Slider
          aria-labelledby={exposureId}
          min={PREVIEW_EXPOSURE_MIN}
          max={PREVIEW_EXPOSURE_MAX}
          step={PREVIEW_EXPOSURE_STEP}
          value={[exposure]}
          onValueChange={([next]) => {
            if (next !== undefined) useEditorStore.getState().setPreviewExposure(next)
          }}
          thumbProps={{
            'aria-labelledby': exposureId,
            'aria-valuetext': formatExposure(exposure),
          }}
          className="flex-1"
        />
        <output
          aria-hidden="true"
          className="w-12 text-right font-mono text-xs tabular-nums text-muted-foreground"
        >
          {formatExposure(exposure)}
        </output>
      </div>
    </div>
  )
}
