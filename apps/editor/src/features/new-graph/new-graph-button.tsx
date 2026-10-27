import { FilePlus2 } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { Kbd } from '@/shared/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { useRequestNewGraph } from './new-graph-context'

/** Header action that starts over with only the Master Stack. */
export function NewGraphButton() {
  const requestNewGraph = useRequestNewGraph()

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
          New graph
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Start over with only the Master Stack <Kbd>Ctrl/⌘ Alt N</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}
