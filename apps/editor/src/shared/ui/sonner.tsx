import * as React from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react'

import { MENU_SURFACE_CLASS } from '@/shared/components/menu-surface'
import { buttonVariants } from '@/shared/ui/button'

// nudo-tsl: the toaster is "unstyled" so every surface is a Tailwind class on our tokens instead
// of sonner's own palette: the same surface, hairline border and shadow as the menus, with a
// destructive border on errors. The theme arrives as a prop (the app's ThemeProvider owns it),
// not from next-themes. Below 600px sonner pins the list between both side offsets but also sets
// `width: 100%`, which pushes its box past the right edge; `w-auto` lets the offsets size it and
// each toast then fills the list.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group max-[600px]:w-auto!"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4 text-muted-foreground" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <CircleAlertIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
        close: <XIcon className="size-3.5" />,
      }}
      style={
        {
          // Sonner's dark theme paints the close button from these; keep it a plain ghost button.
          '--normal-bg': 'transparent',
          '--normal-bg-hover': 'var(--accent)',
          '--normal-border': 'transparent',
          '--normal-border-hover': 'transparent',
          '--normal-text': 'var(--foreground)',
          '--border-radius': 'var(--radius)',
          '--width': '26rem',
        } as React.CSSProperties
      }
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: 'Close notification',
        classNames: {
          toast: `${MENU_SURFACE_CLASS} pointer-events-auto flex w-(--width) items-start max-[600px]:w-full! gap-3 p-3 font-sans text-sm text-foreground data-[type=error]:border-destructive`,
          icon: 'mt-0.5 flex shrink-0 items-center',
          content: 'flex min-w-0 flex-1 flex-col gap-0.5 self-center leading-snug',
          title: 'font-medium',
          description: 'text-muted-foreground',
          actionButton: buttonVariants({ variant: 'outline', size: 'sm', className: 'shrink-0' }),
          cancelButton: buttonVariants({ variant: 'ghost', size: 'sm', className: 'shrink-0' }),
          closeButton: buttonVariants({
            variant: 'ghost',
            size: 'icon-xs',
            className: 'order-last -m-1 shrink-0',
          }),
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
