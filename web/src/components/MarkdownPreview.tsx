import { lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { resolveApiUrl } from '@mindbase/editor-ui/attachments/host'
import { wikiLinksToMarkdown, wikiTargetToPath, WIKI_SCHEME } from '@/lib/wikilink'

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
  const navigate = useNavigate()
  return (
    <div className="markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ...props }) {
            // [[wiki-links]] are rewritten to a `wiki:` scheme; navigate in-app.
            if (href?.startsWith(WIKI_SCHEME)) {
              const target = decodeURIComponent(href.slice(WIKI_SCHEME.length))
              return (
                <a
                  href={`/notes/${wikiTargetToPath(target)}`}
                  className="wiki-link"
                  onClick={(e) => {
                    e.preventDefault()
                    navigate(`/notes/${wikiTargetToPath(target)}`)
                  }}
                >
                  {children}
                </a>
              )
            }
            return (
              <a href={href} {...props}>
                {children}
              </a>
            )
          },
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
        {wikiLinksToMarkdown(content)}
      </ReactMarkdown>
    </div>
  )
}
