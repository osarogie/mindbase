import type { EditorConfig, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical'
import { DecoratorNode } from 'lexical'
import type { JSX } from 'react'
import { resolveSrc, useAttachmentHost } from '../attachments/host'

export type SerializedImageNode = Spread<{ src: string; alt: string }, SerializedLexicalNode>

function ImageComponent({ src, alt }: { src: string; alt: string }) {
  const host = useAttachmentHost()
  if (!src) {
    return <span className="mb-attachment-pending">Uploading {alt || 'file'}…</span>
  }
  return (
    <img
      className="mb-embed-image"
      src={resolveSrc(host, src)}
      alt={alt}
      loading="lazy"
      onError={(e) => (e.target as HTMLImageElement).classList.add('mb-embed-image-broken')}
    />
  )
}

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string
  __alt: string

  static getType(): string {
    return 'mb-image'
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__alt, node.__key)
  }

  static importJSON(json: SerializedImageNode): ImageNode {
    return new ImageNode(json.src, json.alt)
  }

  constructor(src: string, alt: string, key?: NodeKey) {
    super(key)
    this.__src = src
    this.__alt = alt
  }

  exportJSON(): SerializedImageNode {
    return { type: 'mb-image', version: 1, src: this.getSrc(), alt: this.getAlt() }
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

  getAlt(): string {
    return this.getLatest().__alt
  }

  setSrc(src: string): void {
    this.getWritable().__src = src
  }

  getTextContent(): string {
    return this.getAlt()
  }

  decorate(): JSX.Element {
    return <ImageComponent src={this.getSrc()} alt={this.getAlt()} />
  }
}

export function $createImageNode(src: string, alt = ''): ImageNode {
  return new ImageNode(src, alt)
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode
}
