import {
  $applyNodeReplacement,
  TextNode,
  type EditorConfig,
  type LexicalNode,
  type SerializedTextNode,
  type Spread,
} from 'lexical'

export type SerializedWikiLinkNode = Spread<{ target: string; label: string }, SerializedTextNode>
export type SerializedTagNode = Spread<{ tag: string }, SerializedTextNode>
export type SerializedMentionNode = Spread<{ name: string }, SerializedTextNode>
export type SerializedScheduleNode = Spread<{ when: string }, SerializedTextNode>

abstract class MindbaseTokenNode extends TextNode {
  abstract tokenKind(): string
  abstract tokenValue(): string

  isTextEntity(): true {
    return true
  }

  isToken(): true {
    return true
  }
}

export class WikiLinkNode extends MindbaseTokenNode {
  __target: string
  __label: string

  static getType(): string {
    return 'mindbase-wiki-link'
  }

  static clone(node: WikiLinkNode): WikiLinkNode {
    return new WikiLinkNode(node.__target, node.__label, node.__key)
  }

  constructor(target: string, label: string, key?: string) {
    super(label || target, key)
    this.__target = target
    this.__label = label || target
  }

  tokenKind(): string {
    return 'wiki'
  }

  tokenValue(): string {
    return this.__target
  }

  getTarget(): string {
    return this.__target
  }

  getLabel(): string {
    return this.__label
  }

  createDOM(config: EditorConfig): HTMLElement {
    const el = document.createElement('span')
    const theme = config.theme
    el.className = theme.link ? `${theme.link} mb-wiki-link` : 'mb-wiki-link'
    if (this.__target.startsWith('db:')) {
      el.classList.add('mb-db-embed')
    } else {
      el.classList.add('mb-page-link')
    }
    el.textContent = this.__label
    el.setAttribute('data-target', this.__target)
    return el
  }

  updateDOM(): boolean {
    return false
  }

  static importJSON(serialized: SerializedWikiLinkNode): WikiLinkNode {
    return $createWikiLinkNode(serialized.target, serialized.label).updateFromJSON(serialized)
  }

  exportJSON(): SerializedWikiLinkNode {
    return {
      ...super.exportJSON(),
      type: 'mindbase-wiki-link',
      target: this.__target,
      label: this.__label,
    }
  }
}

export class TagNode extends MindbaseTokenNode {
  __tag: string

  static getType(): string {
    return 'mindbase-tag'
  }

  static clone(node: TagNode): TagNode {
    return new TagNode(node.__tag, node.__key)
  }

  constructor(tag: string, key?: string) {
    super(`#${tag}`, key)
    this.__tag = tag
  }

  tokenKind(): string {
    return 'tag'
  }

  tokenValue(): string {
    return this.__tag
  }

  getTag(): string {
    return this.__tag
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const el = document.createElement('span')
    el.className = 'mb-tag-link'
    el.textContent = `#${this.__tag}`
    return el
  }

  updateDOM(): boolean {
    return false
  }

  static importJSON(serialized: SerializedTagNode): TagNode {
    return $createTagNode(serialized.tag).updateFromJSON(serialized)
  }

  exportJSON(): SerializedTagNode {
    return { ...super.exportJSON(), type: 'mindbase-tag', tag: this.__tag }
  }
}

export class MentionNode extends MindbaseTokenNode {
  __name: string

  static getType(): string {
    return 'mindbase-mention'
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__name, node.__key)
  }

  constructor(name: string, key?: string) {
    super(`@${name}`, key)
    this.__name = name
  }

  tokenKind(): string {
    return 'mention'
  }

  tokenValue(): string {
    return this.__name
  }

  getName(): string {
    return this.__name
  }

  createDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'mb-mention'
    el.textContent = `@${this.__name}`
    return el
  }

  updateDOM(): boolean {
    return false
  }

  static importJSON(serialized: SerializedMentionNode): MentionNode {
    return $createMentionNode(serialized.name).updateFromJSON(serialized)
  }

  exportJSON(): SerializedMentionNode {
    return { ...super.exportJSON(), type: 'mindbase-mention', name: this.__name }
  }
}

export class ScheduleNode extends MindbaseTokenNode {
  __when: string

  static getType(): string {
    return 'mindbase-schedule'
  }

  static clone(node: ScheduleNode): ScheduleNode {
    return new ScheduleNode(node.__when, node.__key)
  }

  constructor(when: string, key?: string) {
    super(`>${when}`, key)
    this.__when = when
  }

  tokenKind(): string {
    return 'schedule'
  }

  tokenValue(): string {
    return this.__when
  }

  getWhen(): string {
    return this.__when
  }

  createDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'mb-schedule-badge'
    el.textContent = `>${this.__when}`
    return el
  }

  updateDOM(): boolean {
    return false
  }

  static importJSON(serialized: SerializedScheduleNode): ScheduleNode {
    return $createScheduleNode(serialized.when).updateFromJSON(serialized)
  }

  exportJSON(): SerializedScheduleNode {
    return { ...super.exportJSON(), type: 'mindbase-schedule', when: this.__when }
  }
}

export function $createWikiLinkNode(target: string, label?: string): WikiLinkNode {
  const cleanTarget = target.trim()
  const cleanLabel = (label?.trim() || cleanTarget).trim()
  return $applyNodeReplacement(new WikiLinkNode(cleanTarget, cleanLabel))
}

export function $createTagNode(tag: string): TagNode {
  return $applyNodeReplacement(new TagNode(tag.trim()))
}

export function $createMentionNode(name: string): MentionNode {
  return $applyNodeReplacement(new MentionNode(name.trim()))
}

export function $createScheduleNode(when: string): ScheduleNode {
  return $applyNodeReplacement(new ScheduleNode(when.trim()))
}

export function $isWikiLinkNode(node: LexicalNode | null | undefined): node is WikiLinkNode {
  return node instanceof WikiLinkNode
}

export function $isTagNode(node: LexicalNode | null | undefined): node is TagNode {
  return node instanceof TagNode
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
  return node instanceof MentionNode
}

export function $isScheduleNode(node: LexicalNode | null | undefined): node is ScheduleNode {
  return node instanceof ScheduleNode
}

export const MINDBASE_TOKEN_NODES = [WikiLinkNode, TagNode, MentionNode, ScheduleNode]
