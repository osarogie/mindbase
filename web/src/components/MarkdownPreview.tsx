import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MermaidBlock } from './MermaidBlock'
import { ExcalidrawBlock } from './ExcalidrawBlock'

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
              return <MermaidBlock code={code} />
            }
            if (lang === 'excalidraw') {
              return <ExcalidrawBlock code={code} />
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
              resolved = `/api/files/${notePath}/${src.replace(/^\.\//, '')}`
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
