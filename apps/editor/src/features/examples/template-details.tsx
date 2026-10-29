import { useId, useRef } from 'react'
import type { BlackboardProperty } from '@nudo-tsl/core'

import type { Example } from '@/examples'
import type { TemplateTexture } from '@/examples/template-texture'
import { useT } from '@/i18n/use-t'
import { TypeChip } from '@/shared/components/type-chip'
import { useScrollOverflow } from '@/shared/lib/use-scroll-overflow'
import { cn } from '@/shared/lib/utils'

import { propertyDisplay, templateFacts } from './template-facts'
import { templateTeachesKey } from './template-text'

interface PropertyRowProps {
  property: BlackboardProperty
  textures: readonly TemplateTexture[]
}

function PropertyValue({ property, textures }: PropertyRowProps) {
  const t = useT()
  const display = propertyDisplay(property, textures)
  if (display.kind === 'texture') {
    if (display.label !== null) return <span className="truncate">{t(display.label)}</span>
    return <span className="text-muted-foreground">{t('templates.noTexture')}</span>
  }
  if (display.kind === 'number') return <span className="truncate">{display.text}</span>
  return (
    <span className="flex items-center gap-2">
      {display.hex}
      <span
        aria-hidden="true"
        className="size-4 shrink-0 border"
        style={{ backgroundColor: display.hex }}
      />
    </span>
  )
}

/** A property as a read-only row: its name on the leading edge, type and value on the trailing. */
function PropertyItem({ property, textures }: PropertyRowProps) {
  const display = propertyDisplay(property, textures)
  return (
    <li className="flex h-8 items-center justify-between gap-4 border-b last:border-b-0">
      <span className="truncate text-xs">{property.label}</span>
      <span className="flex shrink-0 items-baseline gap-2 font-mono text-xs text-muted-foreground">
        <TypeChip>{display.chip}</TypeChip>
        <PropertyValue property={property} textures={textures} />
      </span>
    </li>
  )
}

interface TemplateDetailsProps {
  example: Example
  titleId: string
}

/** Under the preview: the template's name, what it teaches and the properties it exposes. */
function TemplateDetails({ example, titleId }: TemplateDetailsProps) {
  const t = useT()
  const propertiesHeadingId = useId()
  const properties = templateFacts(example)?.properties ?? []

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        {/* On a narrow sheet the selected row right below already shows the name. */}
        <h3 id={titleId} className="text-sm font-medium max-md:sr-only">
          {t(example.title)}
        </h3>
        <p className="max-w-prose text-xs text-muted-foreground">
          {t(templateTeachesKey(example))}
        </p>
      </div>
      <section aria-labelledby={propertiesHeadingId} className="flex flex-col gap-2 max-md:hidden">
        <h4
          id={propertiesHeadingId}
          className="font-mono text-micro tracking-[0.2em] text-muted-foreground uppercase"
        >
          {t('templates.properties')}
        </h4>
        {properties.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('templates.noProperties')}</p>
        ) : (
          <ul className="flex max-w-xl flex-col">
            {properties.map((property) => (
              <PropertyItem key={property.id} property={property} textures={example.textures} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/**
 * The details in a box that scrolls when the property list is long. Then, and only then, it takes
 * keyboard focus (so the arrow keys scroll it) and a fade at its foot says there is more below.
 */
export function TemplateDetailsScroller({ example }: { example: Example }) {
  const titleId = useId()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const { isScrollable, hasMoreBelow } = useScrollOverflow(scrollerRef, example.id)

  return (
    <div className="relative flex min-h-0 shrink-0 flex-col border-t md:max-h-[45%]">
      <div
        ref={scrollerRef}
        role="region"
        aria-labelledby={titleId}
        tabIndex={isScrollable ? 0 : undefined}
        data-focus-ring="inset"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <TemplateDetails example={example} titleId={titleId} />
      </div>
      <div
        aria-hidden="true"
        data-more-below={hasMoreBelow}
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-background to-transparent',
          !hasMoreBelow && 'hidden',
        )}
      />
    </div>
  )
}
