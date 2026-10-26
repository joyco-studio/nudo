import { createContext, use, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export type Theme = 'dark' | 'light'

export interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

/** Keep in sync with the pre-paint script in `index.html`. */
export const THEME_STORAGE_KEY = 'nudo-tsl:theme'
const DEFAULT_THEME: Theme = 'dark'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light'
}

function oppositeTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : DEFAULT_THEME
  } catch {
    // Storage can be blocked (privacy settings, sandboxed iframes): fall back to the default.
    return DEFAULT_THEME
  }
}

function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage can be blocked or full: the theme still applies for this session.
  }
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme
}

/**
 * Turns every CSS transition off for one frame. Animations are left alone: switching
 * `animation-name` to none and back would replay the canvas's appear keyframes.
 */
const NO_TRANSITIONS_CSS = '*,*::before,*::after{transition:none!important}'

/**
 * Applies a theme switch at once (user ruling: no fade between themes), the next-themes
 * `disableTransitionOnChange` technique: suspend transitions, apply, force a style recalc so the
 * new colors land while transitions are off, then restore them on the next frame.
 */
function applyThemeInstantly(theme: Theme): void {
  const suspendTransitions = document.createElement('style')
  suspendTransitions.textContent = NO_TRANSITIONS_CSS
  document.head.append(suspendTransitions)

  applyTheme(theme)
  // Reading a computed style flushes the recalc now, before the transitions come back.
  window.getComputedStyle(document.body).getPropertyValue('color')

  requestAnimationFrame(() => {
    suspendTransitions.remove()
  })
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)
  const appliedThemeRef = useRef<Theme | null>(null)

  useLayoutEffect(() => {
    // The first apply only mirrors the pre-paint script in index.html; later ones are switches.
    if (appliedThemeRef.current === null) applyTheme(theme)
    else if (appliedThemeRef.current !== theme) applyThemeInstantly(theme)
    appliedThemeRef.current = theme
  }, [theme])

  const toggleTheme = useCallback(() => {
    const nextTheme = oppositeTheme(theme)
    persistTheme(nextTheme)
    setTheme(nextTheme)
  }, [theme])

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext)
  if (context === null) {
    throw new Error('useTheme must be used inside <ThemeProvider>.')
  }
  return context
}
