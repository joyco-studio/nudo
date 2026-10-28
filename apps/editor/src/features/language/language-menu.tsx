import { Languages } from 'lucide-react'

import { useCanvasMenu } from '@/features/canvas/use-canvas-menu'
import { isLocale, LOCALES } from '@/i18n/locale'
import type { Locale } from '@/i18n/locale'
import { useLocale, useT } from '@/i18n/use-t'
import { MENU_SURFACE_CLASS } from '@/shared/components/menu-surface'
import { EXCLUSIVE_TRIGGER_PROPS } from '@/shared/lib/overlay-coordinator'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

/** Each language is named in itself, so a person can find theirs whatever the UI speaks now. */
const LANGUAGE_NAMES: Readonly<Record<Locale, string>> = {
  en: 'English',
  es: 'Español',
}

/** The short code the header shows: "EN", "ES". */
const localeCode = (locale: Locale): string => locale.toUpperCase()

/**
 * The header's EN / ES switch: a menu with one radio item per language, each named in its own
 * language (and marked with its `lang`). Choosing one switches every text at once and is saved.
 * On a narrow header it is an icon; below 360px there is no room beside the graph name, so it
 * steps out like the Commands button, and the browser's language (the default) applies.
 */
export function LanguageMenu() {
  const t = useT()
  const { locale, setLocale } = useLocale()
  const menu = useCanvasMenu()
  const code = localeCode(locale)

  return (
    <DropdownMenu onOpenChange={menu.onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="accent"
              size="sm"
              aria-label={t('language.trigger', { code })}
              className="max-[359px]:hidden"
              {...EXCLUSIVE_TRIGGER_PROPS}
            >
              <Languages aria-hidden="true" />
              <span aria-hidden="true" className="font-mono text-xs max-sm:hidden">
                {code}
              </span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('language.tooltip')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        aria-label={t('language.menu')}
        align="end"
        className={cn(MENU_SURFACE_CLASS, 'w-auto min-w-36 p-1')}
        onCloseAutoFocus={menu.onCloseAutoFocus}
      >
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(next) => {
            if (isLocale(next)) setLocale(next)
          }}
        >
          {LOCALES.map((item) => (
            <DropdownMenuRadioItem
              key={item}
              value={item}
              lang={item}
              className="h-7 gap-3 rounded-none py-0 pl-2 text-xs"
            >
              <span className="flex-1">{LANGUAGE_NAMES[item]}</span>
              <span aria-hidden="true" className="font-mono text-micro text-muted-foreground">
                {localeCode(item)}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
