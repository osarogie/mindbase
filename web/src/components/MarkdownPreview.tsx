import { lazy, Suspense } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { resolveApiUrl } from '@mindbase/editor-ui/attachments/host'

// Diagram renderers pull in heavy libraries (mermaid ~1.8 MB, excalidraw),
// so they're code-split and only fetched when a note actually embeds one.
const MermaidBlock = lazy(() =>
  import('./MermaidBlock').then((m) => ({ default: m.MermaidBlock })),
)
const ExcalidrawBlock = lazy(() =>
  import('./ExcalidrawBlock').then((m) => ({ default: m.ExcalidrawBlock })),
)

const DiagramFallback = () => <div className="diagram-loading">Loading diagram…</div>

interface Props {
  content: string
  notePath?: string
}

export function MarkdownPreview({ content, notePath }: Props) {
  return (
    <div className="markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const lang = match?.[1]
            const code = String(children).replace(/\n$/, '')

            if (lang === 'mermaid') {
              return (
                <Suspense fallback={<DiagramFallback />}>
                  <MermaidBlock code={code} />
                </Suspense>
              )
            }
            if (lang === 'excalidraw') {
              return (
                <Suspense fallback={<DiagramFallback />}>
                  <ExcalidrawBlock code={code} />
                </Suspense>
              )
            }

            const inline = !className
            if (inline) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            }
            return (
              <pre>
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            )
          },
          img({ src, alt, ...props }) {
            let resolved = src
            if (notePath && src && !src.startsWith('http') && !src.startsWith('/api/')) {
              resolved = resolveApiUrl(notePath, src)
            }
            return <img src={resolved} alt={alt ?? ''} {...props} />
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
