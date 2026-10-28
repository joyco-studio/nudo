import type { PropertyError } from '@nudo-tsl/core'

import type { Translate } from '@/i18n/translate'

/**
 * Applies a new label, or says why it can't be: labels are free text but never empty. The reference
 * that follows the label is always made valid and unique, so a failure is unexpected.
 */
export function renameLabelOrExplain(
  renameLabel: (label: string) => PropertyError | null,
  label: string,
  t: Translate,
): string | null {
  if (label === '') return t('property.error.emptyLabel')
  return renameLabel(label) === null ? null : t('property.error.renameFailed')
}

/**
 * Why a reference name was rejected, in words for the field's message. The invalid-name message
 * mirrors core `isValidIdentifier`: identifier syntax, at most 64 characters, no reserved word.
 */
export function referenceErrorMessage(error: PropertyError, name: string, t: Translate): string {
  switch (error.code) {
    case 'invalid-name':
      return t(name === '' ? 'property.error.emptyReference' : 'property.error.invalidReference')
    case 'duplicate-name':
      return t('property.error.duplicateReference')
    case 'property-not-found':
      return t('property.error.missing')
    case 'duplicate-id':
    case 'type-mismatch':
      return t('property.error.renameFailed')
  }
}
