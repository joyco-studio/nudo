import { useTheme } from '@/app/theme-provider'
import { useT } from '@/i18n/use-t'
import { Toaster } from '@/shared/ui/sonner'

import { useNoticeToasts } from './use-notice-toasts'

/**
 * The one toaster of the editor: renders the store's notices as toasts in the app's theme. Sonner
 * brings the accessibility: a polite live region, Alt+T to move focus into the toasts, and no
 * motion under `prefers-reduced-motion`.
 */
export function NoticeToaster() {
  const { theme } = useTheme()
  const t = useT()
  useNoticeToasts()

  return (
    <Toaster
      theme={theme}
      position="top-center"
      offset={{ top: '4rem' }}
      containerAriaLabel={t('notice.region')}
      closeButtonAriaLabel={t('notice.close')}
    />
  )
}
