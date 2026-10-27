import { Slider } from '@/shared/ui/slider'

const HUE_MAX = 360
const HUE_TRACK =
  'linear-gradient(to right, #f00 0%, #ff0 16.67%, #0f0 33.33%, #0ff 50%, #00f 66.67%, #f0f 83.33%, #f00 100%)'
const HUE_TRACK_STYLE = { backgroundImage: HUE_TRACK }

interface HueSliderProps {
  /** Degrees, 0..360. */
  hue: number
  onChange: (hue: number) => void
}

/**
 * The hue track (shadcn Slider). Dragging or pressing on the track follows the pointer; the
 * arrows move 1° (Shift or Page Up/Down: 10°), Home and End go to the ends.
 */
export function HueSlider({ hue, onChange }: HueSliderProps) {
  const degrees = Math.round(hue)

  return (
    <Slider
      min={0}
      max={HUE_MAX}
      step={1}
      value={[degrees]}
      onValueChange={([next]) => {
        if (next !== undefined) onChange(next)
      }}
      // The track is drawn 12px tall inside a 24px hit area.
      className="h-6"
      trackClassName="h-3! rounded-none border border-border"
      trackStyle={HUE_TRACK_STYLE}
      rangeClassName="hidden"
      thumbClassName="h-4 w-1.5 rounded-none border-2 border-white bg-transparent shadow-[0_0_0_1px_rgb(0_0_0/0.6)] ring-0 hover:ring-0 active:ring-0"
      thumbProps={{ 'aria-label': 'Hue', 'aria-valuetext': `${String(degrees)} degrees` }}
    />
  )
}
