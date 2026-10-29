import { Search } from 'lucide-react'

import { MOD } from '@/features/shortcuts/key-chord'
import { useT } from '@/i18n/use-t'
import { Button } from '@/shared/ui/button'
import { Kbd } from '@/shared/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { useOpenCommandPalette } from './command-context'

/** Header action that opens the command palette, so Ctrl/⌘ K is discoverable. */
export function CommandPaletteButton() {
  const openCommandPalette = useOpenCommandPalette()
  const t = useT()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A narrow (phone) header keeps it in the More menu (HeaderOverflowMenu). */}
        <Button
          variant="accent"
          size="sm"
          aria-keyshortcuts="Control+K Meta+K"
          className="max-sm:hidden"
          onClick={(event) => {
            openCommandPalette(event.currentTarget)
          }}
        >
          <Search aria-hidden="true" />
          {t('palette.button')}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {t('palette.buttonTooltip')} <Kbd>{MOD} K</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}
