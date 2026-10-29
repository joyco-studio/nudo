import { FilePlus2 } from 'lucide-react'

import { useT } from '@/i18n/use-t'
import { Button } from '@/shared/ui/button'
import { Kbd } from '@/shared/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { MOD, formatChord } from '@/features/shortcuts/key-chord'

import { useRequestNewGraph } from './new-graph-context'

const NEW_GRAPH_CHORD = [MOD, 'Alt', 'N'] as const

/** Header action that starts over with only the Master Stack. */
export function NewGraphButton() {
  const requestNewGraph = useRequestNewGraph()
  const t = useT()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="accent"
          size="sm"
          aria-keyshortcuts="Control+Alt+N Meta+Alt+N"
          // A narrow header keeps it in the More menu (HeaderOverflowMenu).
          className="max-sm:hidden"
          onClick={(event) => {
            requestNewGraph(event.currentTarget)
          }}
        >
          <FilePlus2 aria-hidden="true" />
          {t('newGraph.button')}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {t('newGraph.tooltip')} <Kbd>{formatChord(NEW_GRAPH_CHORD, t)}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}
