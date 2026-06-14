import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { THEME_EVENT, currentTheme } from '@/lib/theme'

// One-time global config; the per-render theme is passed via `mermaid.render`'s
// fenced `%%{init}%%` directive below so diagrams follow the app's light/dark mode.
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })

export function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const id = useRef(`mermaid-${Math.random().toString(36).slice(2)}`)
  // Re-render when the theme toggles so the diagram colors stay legible.
  const [theme, setTheme] = useState(currentTheme)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onTheme = () => setTheme(currentTheme())
    window.addEventListener(THEME_EVENT, onTheme)
    return () => window.removeEventListener(THEME_EVENT, onTheme)
  }, [])

  useEffect(() => {
    if (!ref.current) return
    let cancelled = false
    const mermaidTheme = theme === 'dark' ? 'dark' : 'default'
    const source = `%%{init: {'theme':'${mermaidTheme}'}}%%\n${code}`
    mermaid
      .render(id.current, source)
      .then(({ svg }) => {
        if (!cancelled && ref.current) ref.current.innerHTML = svg
      })
      .catch((err) => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = `<pre class="error">${String(err)}</pre>`
        }
      })
    return () => {
      cancelled = true
    }
  }, [code, theme])

  return <div className="mermaid-block" ref={ref} />
}
