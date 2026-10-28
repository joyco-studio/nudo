import type { PropertyError } from '@nudo-tsl/core'

import type { MessageKey } from '@/i18n/translate'

/**
 * Applies a new label, or says why it can't be: labels are free text but never empty. The reference
 * that follows the label is always made valid and unique, so a failure is unexpected.
 */
export function renameLabelOrExplain(
  renameLabel: (label: string) => PropertyError | null,
  label: string,
): MessageKey | null {
  if (label === '') return 'property.error.emptyLabel'
  return renameLabel(label) === null ? null : 'property.error.renameFailed'
}

/**
 * Why a reference name was rejected, as the message key the field shows. The invalid-name message
 * mirrors core `isValidIdentifier`: identifier syntax, at most 64 characters, no reserved word.
 */
export function referenceErrorMessage(error: PropertyError, name: string): MessageKey {
  switch (error.code) {
    case 'invalid-name':
      return name === '' ? 'property.error.emptyReference' : 'property.error.invalidReference'
    case 'duplicate-name':
      return 'property.error.duplicateReference'
    case 'property-not-found':
      return 'property.error.missing'
    case 'duplicate-id':
    case 'type-mismatch':
      return 'property.error.renameFailed'
  }
}
