import { useMemo } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

interface ExcalidrawData {
  type?: string
  version?: number
  elements?: unknown[]
  appState?: Record<string, unknown>
  files?: Record<string, unknown>
}

export function ExcalidrawBlock({ code }: { code: string }) {
  const data = useMemo<ExcalidrawData | null>(() => {
    try {
      return JSON.parse(code) as ExcalidrawData
    } catch {
      return null
    }
  }, [code])

  if (!data) {
    return (
      <div className="excalidraw-error">
        Invalid Excalidraw JSON. Use a fenced code block with language{' '}
        <code>excalidraw</code>.
      </div>
    )
  }

  return (
    <div className="excalidraw-block">
      <Excalidraw
        initialData={{
          elements: (data.elements ?? []) as never[],
          appState: { viewBackgroundColor: '#1e1e2e', ...(data.appState ?? {}) },
          files: (data.files ?? {}) as never,
        }}
        viewModeEnabled
        zenModeEnabled
      />
    </div>
  )
}
