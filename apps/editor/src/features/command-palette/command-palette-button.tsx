import { Search } from 'lucide-react'

import { MOD } from '@/features/shortcuts/key-chord'
import { Button } from '@/shared/ui/button'
import { Kbd } from '@/shared/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { useOpenCommandPalette } from './command-context'

/** Header action that opens the command palette, so Ctrl/⌘ K is discoverable. Hidden on phones. */
export function CommandPaletteButton() {
  const openCommandPalette = useOpenCommandPalette()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/*
         * Left out of a narrow (phone) header: the palette is a keyboard accelerator, and every
         * action it runs has its own control. The header keeps room for the graph name there.
         */}
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
          Commands
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Search every action and node <Kbd>{MOD} K</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}
