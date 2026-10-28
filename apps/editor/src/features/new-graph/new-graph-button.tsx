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
          onClick={(event) => {
            requestNewGraph(event.currentTarget)
          }}
        >
          <FilePlus2 aria-hidden="true" />
          {/* Icon only on a narrow header; the label stays the accessible name. */}
          <span className="max-sm:sr-only">{t('newGraph.button')}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {t('newGraph.tooltip')} <Kbd>{formatChord(NEW_GRAPH_CHORD, t)}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}
