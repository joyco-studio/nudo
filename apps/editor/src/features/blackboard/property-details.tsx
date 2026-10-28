import { useId } from 'react'
import type { BlackboardProperty } from '@nudo-tsl/core'

import { Checkbox } from '@/shared/ui/checkbox'
import { Label } from '@/shared/ui/label'
import { useT } from '@/i18n/use-t'

import { referenceErrorMessage, renameLabelOrExplain } from './property-messages'
import { PropertyTextField } from './property-text-field'
import type { BlackboardActions } from './blackboard-actions'

export interface PropertyDetailsProps {
  property: BlackboardProperty
  actions: BlackboardActions
}

/**
 * What a row's disclosure reveals, like Unity's Blackboard: the display name, the reference (the
 * uniform name in exported code) and whether the property is exposed.
 */
export function PropertyDetails({ property, actions }: PropertyDetailsProps) {
  const nameId = useId()
  const referenceId = useId()
  const exposedId = useId()
  const exposedHintId = useId()
  const t = useT()

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1.5 pt-0.5 pr-2 pb-2 pl-8">
      <Label htmlFor={nameId} className="h-6 text-xs font-normal text-muted-foreground">
        {t('property.name')}
      </Label>
      <PropertyTextField
        id={nameId}
        font="sans"
        value={property.label}
        onInvalidBlur="keep"
        commit={(text) =>
          renameLabelOrExplain((label) => actions.renameLabel(property.id, label), text, t)
        }
      />
      <Label htmlFor={referenceId} className="h-6 text-xs font-normal text-muted-foreground">
        {t('property.reference')}
      </Label>
      <PropertyTextField
        id={referenceId}
        font="mono"
        value={property.name}
        onInvalidBlur="keep"
        commit={(text) => {
          const error = actions.renameReference(property.id, text)
          return error === null ? null : referenceErrorMessage(error, text, t)
        }}
      />
      <div className="col-span-2 flex flex-col gap-0.5">
        <div className="flex h-6 items-center gap-2">
          <Checkbox
            id={exposedId}
            checked={property.exposed}
            aria-describedby={exposedHintId}
            // The vendored resting border all but vanishes on the panel; unchecked must still show.
            className="cursor-pointer border-muted-foreground"
            onCheckedChange={(checked) => {
              actions.setExposed(property.id, checked === true)
            }}
          />
          <Label htmlFor={exposedId} className="cursor-pointer text-xs font-normal">
            {t('property.exposed')}
          </Label>
        </div>
        <p id={exposedHintId} className="text-micro leading-4 text-muted-foreground">
          {t('property.exposedHint')}
        </p>
      </div>
    </div>
  )
}
