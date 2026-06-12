import type { EditorConfig, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical'
import { DecoratorNode } from 'lexical'
import type { JSX } from 'react'
import { resolveSrc, useAttachmentHost } from '../attachments/host'

export type SerializedFileCardNode = Spread<{ src: string; label: string }, SerializedLexicalNode>

function FileCardComponent({ src, label }: { src: string; label: string }) {
  const host = useAttachmentHost()
  if (!src) {
    return <span className="mb-attachment-pending">Uploading {label || 'file'}…</span>
  }
  return (
    <a className="mb-file-card" href={resolveSrc(host, src)} target="_blank" rel="noreferrer">
      <span className="mb-file-card-icon" aria-hidden>
        📎
      </span>
      <span className="mb-file-card-label">{label}</span>
    </a>
  )
}

export class FileCardNode extends DecoratorNode<JSX.Element> {
  __src: string
  __label: string

  static getType(): string {
    return 'mb-file-card'
  }

  static clone(node: FileCardNode): FileCardNode {
    return new FileCardNode(node.__src, node.__label, node.__key)
  }

  static importJSON(json: SerializedFileCardNode): FileCardNode {
    return new FileCardNode(json.src ?? '', json.label ?? '')
  }

  constructor(src: string, label: string, key?: NodeKey) {
    super(key)
    this.__src = src
    this.__label = label
  }

  exportJSON(): SerializedFileCardNode {
    return { type: 'mb-file-card', version: 1, src: this.getSrc(), label: this.getLabel() }
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span')
    span.className = 'mb-embed'
    return span
  }

  updateDOM(): boolean {
    return false
  }

  isInline(): boolean {
    return true
  }

  getSrc(): string {
    return this.getLatest().__src
  }

  getLabel(): string {
    return this.getLatest().__label
  }

  setSrc(src: string): void {
    this.getWritable().__src = src
  }

  getTextContent(): string {
    return this.getLabel()
  }

  decorate(): JSX.Element {
    return <FileCardComponent src={this.getSrc()} label={this.getLabel()} />
  }
}

export function $createFileCardNode(src: string, label: string): FileCardNode {
  return new FileCardNode(src, label)
}

export function $isFileCardNode(node: LexicalNode | null | undefined): node is FileCardNode {
  return node instanceof FileCardNode
}
