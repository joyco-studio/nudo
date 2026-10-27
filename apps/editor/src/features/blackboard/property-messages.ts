import type { PropertyError } from '@nudo-tsl/core'

const EMPTY_LABEL_MESSAGE = 'Enter a name.'
const EMPTY_REFERENCE_MESSAGE = 'Enter a reference name.'
const INVALID_REFERENCE_MESSAGE =
  'Use letters, digits, _ or $, start with a letter, and avoid code words like class.'
const DUPLICATE_REFERENCE_MESSAGE = 'Another property already uses this reference.'
const MISSING_PROPERTY_MESSAGE = 'This property no longer exists.'
const RENAME_FAILED_MESSAGE = "Couldn't rename this property."

/**
 * Applies a new label, or says why it can't be: labels are free text but never empty. The reference
 * that follows the label is always made valid and unique, so a failure is unexpected.
 */
export function renameLabelOrExplain(
  renameLabel: (label: string) => PropertyError | null,
  label: string,
): string | null {
  if (label === '') return EMPTY_LABEL_MESSAGE
  return renameLabel(label) === null ? null : RENAME_FAILED_MESSAGE
}

/** Why a reference name was rejected, in words for the field's message. */
export function referenceErrorMessage(error: PropertyError, name: string): string {
  switch (error.code) {
    case 'invalid-name':
      return name === '' ? EMPTY_REFERENCE_MESSAGE : INVALID_REFERENCE_MESSAGE
    case 'duplicate-name':
      return DUPLICATE_REFERENCE_MESSAGE
    case 'property-not-found':
      return MISSING_PROPERTY_MESSAGE
    case 'duplicate-id':
    case 'type-mismatch':
      return RENAME_FAILED_MESSAGE
  }
}
