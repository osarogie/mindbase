import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { setTheme, storedTheme, systemTheme, type Theme } from '@/lib/theme'

/** Sidebar light/dark toggle. */
export function ThemeToggle() {
  const [theme, setLocal] = useState<Theme>(() => storedTheme() ?? systemTheme())

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setLocal(next)
  }

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
