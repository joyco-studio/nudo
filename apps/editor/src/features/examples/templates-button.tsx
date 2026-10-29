import { LayoutTemplate } from 'lucide-react'

import { useT } from '@/i18n/use-t'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { useOpenTemplatesBrowser } from './examples-context'

/** Header action that opens the templates browser; focus comes back here when it closes. */
export function TemplatesButton() {
  const openTemplatesBrowser = useOpenTemplatesBrowser()
  const t = useT()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A narrow header has no room for it; like Commands, it steps out (⌘K still browses the
            templates). */}
        <Button
          variant="accent"
          size="sm"
          className="max-sm:hidden"
          aria-haspopup="dialog"
          onClick={(event) => {
            openTemplatesBrowser(event.currentTarget, null)
          }}
        >
          <LayoutTemplate aria-hidden="true" />
          {t('templates.button')}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t('templates.tooltip')}</TooltipContent>
    </Tooltip>
  )
}
