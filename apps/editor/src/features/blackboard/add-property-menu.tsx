import { Plus } from 'lucide-react'
import type { PropertyId } from '@nudo-tsl/core'

import { useCanvasMenu } from '@/features/canvas/use-canvas-menu'
import { MENU_SURFACE_CLASS } from '@/shared/components/menu-surface'
import { EXCLUSIVE_TRIGGER_PROPS } from '@/shared/lib/overlay-coordinator'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { useT } from '@/i18n/use-t'

import { ADD_PROPERTY_ATTRIBUTE } from './property-focus'
import { PROPERTY_KINDS, PROPERTY_KIND_SPECS } from './property-kinds'
import type { PropertyKind } from './property-kinds'
import { startRenaming } from './renaming-property'

const ADD_PROPERTY_TRIGGER_PROPS = { [ADD_PROPERTY_ATTRIBUTE]: '', ...EXCLUSIVE_TRIGGER_PROPS }

export interface AddPropertyMenuProps {
  onAdd: (kind: PropertyKind) => PropertyId | null
}

/**
 * The "+" in the Properties header: a menu of property types. The new property opens straight
 * into its inline rename, with its unique default name selected.
 */
export function AddPropertyMenu({ onAdd }: AddPropertyMenuProps) {
  const menu = useCanvasMenu()
  const t = useT()

  return (
    <DropdownMenu onOpenChange={menu.onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              static
              variant="ghost"
              size="icon-sm"
              aria-label={t('property.add')}
              {...ADD_PROPERTY_TRIGGER_PROPS}
            >
              <Plus aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('property.add')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        aria-label={t('property.add')}
        align="end"
        className={cn(MENU_SURFACE_CLASS, 'w-auto min-w-36 p-1')}
        onCloseAutoFocus={menu.onCloseAutoFocus}
      >
        {PROPERTY_KINDS.map((kind) => (
          <DropdownMenuItem
            key={kind}
            className="h-7 rounded-none py-0 pr-2 pl-2 text-xs"
            onSelect={() => {
              const id = onAdd(kind)
              if (id !== null) {
                menu.runAfterClose(() => {
                  startRenaming(id)
                })
              }
            }}
          >
            {t(PROPERTY_KIND_SPECS[kind].label)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
