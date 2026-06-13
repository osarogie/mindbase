// Light/dark theme: toggles the `.dark` class on <html> (shadcn convention),
// persisted to localStorage and defaulting to the OS preference.

export type Theme = 'light' | 'dark'

const KEY = 'mindbase-theme'

export function storedTheme(): Theme | null {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
  return v === 'light' || v === 'dark' ? v : null
}

export function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

/** Resolve + apply the initial theme (stored override, else OS). Call at startup. */
export function initTheme(): Theme {
  const t = storedTheme() ?? systemTheme()
  applyTheme(t)
  return t
}

/** Persist + apply an explicit theme choice. */
export function setTheme(theme: Theme): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, theme)
  applyTheme(theme)
}
