# Embed Attachments in the Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Images render inline and other files render as cards in the shared Lexical editor, insertable by paste/drag-drop, slash-command picker, and the attachments panel — per `docs/superpowers/specs/2026-06-12-embed-attachments-design.md`.

**Architecture:** All embed functionality lives in the shared `editor-ui` package behind an `AttachmentHost` adapter (upload / resolveUrl / list). The web app implements the adapter with the existing `/api/attachments` + `/api/files` endpoints. Markdown stays standard: `![alt](note.attachments/file.png)` (sibling-relative, portable), legacy bare filenames still read.

**Tech Stack:** Lexical 0.31 (DecoratorNode, TextMatchTransformer, DRAG_DROP_PASTE), React 18, vitest + @lexical/headless for unit tests, existing Go API (no server changes).

**Conventions you must know:**
- `editor-ui` is imported by web via the alias `@mindbase/editor-ui/*` → `editor-ui/src/*` (vite + tsconfig), and built standalone to `internal/editor/lexical/editor.js` for the mobile/macOS WebView shells.
- Attachments for `journal/x.md` live in `journal/x.attachments/` on disk; API list `GET /api/attachments/<note>`, upload `POST /api/attachments/<note>` (multipart field `file`, returns `{name,...}` — the server name is authoritative), file serving `GET /api/files/<note>/<filename>`.
- Run all commands from the repo root `/Users/osarogie/mindbase` unless stated. Package manager is **bun**.
- After changing `editor-ui` or `web`, the Go-served bundle is refreshed with: `bun run web:build && rm -rf internal/webui/dist && cp -R web/dist internal/webui/dist && go build -o bin/mindbase ./cmd/mindbase`.

---

### Task 1: Test infrastructure for editor-ui

**Files:**
- Modify: `editor-ui/package.json`
- Create: `editor-ui/vitest.config.ts`
- Create: `editor-ui/src/__tests__/smoke.test.ts`

- [ ] **Step 1: Add vitest + headless lexical dev-deps**

Run:
```bash
cd editor-ui && bun add -d vitest @lexical/headless@0.31.2 jsdom && cd ..
```

- [ ] **Step 2: Add the test script and config**

In `editor-ui/package.json` `"scripts"`, add:
```json
"test": "vitest run"
```

Create `editor-ui/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 3: Write a smoke test proving headless lexical works**

Create `editor-ui/src/__tests__/smoke.test.ts`:
```ts
import { createHeadlessEditor } from '@lexical/headless'
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown'
import { describe, expect, it } from 'vitest'

describe('headless lexical', () => {
  it('round-trips markdown', () => {
    const editor = createHeadlessEditor({ namespace: 'test', onError: (e) => { throw e } })
    editor.update(() => $convertFromMarkdownString('# Hello', TRANSFORMERS), { discrete: true })
    let out = ''
    editor.getEditorState().read(() => { out = $convertToMarkdownString(TRANSFORMERS) })
    expect(out).toBe('# Hello')
  })
})
```

- [ ] **Step 4: Run it**

Run: `cd editor-ui && bun run test`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add editor-ui/package.json editor-ui/vitest.config.ts editor-ui/src/__tests__/smoke.test.ts bun.lock
git commit -m "test(editor-ui): add vitest + headless lexical test setup"
```

---

### Task 2: Attachment host module (pure helpers + context)

**Files:**
- Create: `editor-ui/src/attachments/host.ts`
- Test: `editor-ui/src/attachments/host.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `editor-ui/src/attachments/host.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { attachmentFilename, attachmentMarkdownPath, isImagePath, resolveApiUrl } from './host'

describe('isImagePath', () => {
  it('detects image extensions case-insensitively', () => {
    for (const p of ['a.png', 'b.JPG', 'x.attachments/c.webp', 'd.svg?x=1']) {
      expect(isImagePath(p)).toBe(true)
    }
  })
  it('rejects non-images', () => {
    for (const p of ['a.pdf', 'b.zip', 'noext', 'c.txt']) {
      expect(isImagePath(p)).toBe(false)
    }
  })
})

describe('attachmentFilename', () => {
  it('returns the last path segment without query/hash', () => {
    expect(attachmentFilename('welcome.attachments/photo.png')).toBe('photo.png')
    expect(attachmentFilename('photo.png')).toBe('photo.png')
    expect(attachmentFilename('a/b/c.pdf?dl=1#x')).toBe('c.pdf')
  })
})

describe('attachmentMarkdownPath', () => {
  it('builds the sibling-relative portable path', () => {
    expect(attachmentMarkdownPath('welcome.md', 'photo.png')).toBe('welcome.attachments/photo.png')
    expect(attachmentMarkdownPath('journal/2026-06-11.md', 'a.pdf')).toBe('2026-06-11.attachments/a.pdf')
  })
})

describe('resolveApiUrl', () => {
  it('builds /api/files URLs from both path forms', () => {
    expect(resolveApiUrl('welcome.md', 'welcome.attachments/photo.png')).toBe('/api/files/welcome.md/photo.png')
    expect(resolveApiUrl('welcome.md', 'photo.png')).toBe('/api/files/welcome.md/photo.png')
    expect(resolveApiUrl('journal/x.md', 'x.attachments/a.pdf')).toBe('/api/files/journal/x.md/a.pdf')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd editor-ui && bun run test`
Expected: FAIL — cannot resolve `./host`.

- [ ] **Step 3: Implement**

Create `editor-ui/src/attachments/host.ts`:
```ts
import { createContext, useContext } from 'react'

export interface AttachmentInfo {
  name: string
  /** Markdown-relative path, e.g. "welcome.attachments/photo.png" */
  path: string
}

/** Host adapter supplied by the embedding app (web NoteView, future WebView shells). */
export interface AttachmentHost {
  upload(file: File): Promise<{ path: string }>
  resolveUrl(path: string): string
  list(): Promise<AttachmentInfo[]>
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'])

export function isImagePath(path: string): boolean {
  const clean = path.split(/[?#]/)[0]
  const dot = clean.lastIndexOf('.')
  if (dot < 0) return false
  return IMAGE_EXTENSIONS.has(clean.slice(dot + 1).toLowerCase())
}

export function attachmentFilename(src: string): string {
  const clean = src.split(/[?#]/)[0]
  return clean.split('/').pop() ?? clean
}

/** "journal/x.md" + "photo.png" → "x.attachments/photo.png" (sibling-relative, portable). */
export function attachmentMarkdownPath(notePath: string, filename: string): string {
  const noteFile = notePath.split('/').pop() ?? notePath
  const base = noteFile.replace(/\.[^.]+$/, '')
  return `${base}.attachments/${filename}`
}

/** Resolve a markdown src (sibling-relative or legacy bare filename) to the server URL. */
export function resolveApiUrl(notePath: string, src: string): string {
  return `/api/files/${notePath}/${attachmentFilename(src)}`
}

export const AttachmentHostContext = createContext<AttachmentHost | null>(null)

/** Context host (web) falls back to a bridge-registered host (WebView shells). */
export function useAttachmentHost(): AttachmentHost | null {
  const fromContext = useContext(AttachmentHostContext)
  if (fromContext) return fromContext
  return (window as Window & { mindbaseAttachmentHost?: AttachmentHost }).mindbaseAttachmentHost ?? null
}

/** Absolute/external sources pass through; vault-relative sources go through the host. */
export function resolveSrc(host: AttachmentHost | null, src: string): string {
  if (/^(?:https?:)?\/\//.test(src) || src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) {
    return src
  }
  return host ? host.resolveUrl(src) : src
}
```

- [ ] **Step 4: Run tests**

Run: `cd editor-ui && bun run test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add editor-ui/src/attachments/
git commit -m "feat(editor-ui): attachment host adapter interface and path helpers"
```

---

### Task 3: ImageNode and FileCardNode

**Files:**
- Create: `editor-ui/src/nodes/ImageNode.tsx`
- Create: `editor-ui/src/nodes/FileCardNode.tsx`
- Test: `editor-ui/src/nodes/attachmentNodes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `editor-ui/src/nodes/attachmentNodes.test.ts`:
```ts
import { createHeadlessEditor } from '@lexical/headless'
import { $getRoot, $createParagraphNode } from 'lexical'
import { describe, expect, it } from 'vitest'
import { $createImageNode, $isImageNode, ImageNode } from './ImageNode'
import { $createFileCardNode, $isFileCardNode, FileCardNode } from './FileCardNode'

function makeEditor() {
  return createHeadlessEditor({
    namespace: 'test',
    nodes: [ImageNode, FileCardNode],
    onError: (e) => { throw e },
  })
}

describe('ImageNode', () => {
  it('stores src/alt, is inline, survives JSON round-trip', () => {
    const editor = makeEditor()
    editor.update(() => {
      const node = $createImageNode('welcome.attachments/p.png', 'pic')
      expect($isImageNode(node)).toBe(true)
      expect(node.getSrc()).toBe('welcome.attachments/p.png')
      expect(node.getAlt()).toBe('pic')
      expect(node.isInline()).toBe(true)
      const json = node.exportJSON()
      const back = ImageNode.importJSON(json)
      expect(back.getSrc()).toBe('welcome.attachments/p.png')
      expect(back.getAlt()).toBe('pic')
      const p = $createParagraphNode()
      p.append(node)
      $getRoot().append(p)
    }, { discrete: true })
  })

  it('setSrc updates the writable node', () => {
    const editor = makeEditor()
    editor.update(() => {
      const node = $createImageNode('', 'pending.png')
      const p = $createParagraphNode()
      p.append(node)
      $getRoot().append(p)
      node.setSrc('x.attachments/pending.png')
      expect(node.getSrc()).toBe('x.attachments/pending.png')
    }, { discrete: true })
  })
})

describe('FileCardNode', () => {
  it('stores src/label, is inline, survives JSON round-trip', () => {
    const editor = makeEditor()
    editor.update(() => {
      const node = $createFileCardNode('welcome.attachments/r.pdf', 'r.pdf')
      expect($isFileCardNode(node)).toBe(true)
      expect(node.getSrc()).toBe('welcome.attachments/r.pdf')
      expect(node.getLabel()).toBe('r.pdf')
      expect(node.isInline()).toBe(true)
      const back = FileCardNode.importJSON(node.exportJSON())
      expect(back.getSrc()).toBe('welcome.attachments/r.pdf')
      expect(back.getLabel()).toBe('r.pdf')
      const p = $createParagraphNode()
      p.append(node)
      $getRoot().append(p)
    }, { discrete: true })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd editor-ui && bun run test`
Expected: FAIL — cannot resolve `./ImageNode`.

- [ ] **Step 3: Implement ImageNode**

Create `editor-ui/src/nodes/ImageNode.tsx`:
```tsx
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
```

- [ ] **Step 4: Implement FileCardNode**

Create `editor-ui/src/nodes/FileCardNode.tsx`:
```tsx
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
    return new FileCardNode(json.src, json.label)
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
```

- [ ] **Step 5: Run tests**

Run: `cd editor-ui && bun run test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add editor-ui/src/nodes/ImageNode.tsx editor-ui/src/nodes/FileCardNode.tsx editor-ui/src/nodes/attachmentNodes.test.ts
git commit -m "feat(editor-ui): ImageNode and FileCardNode decorator nodes"
```

---

### Task 4: Markdown transformer for `![alt](src)`

**Files:**
- Create: `editor-ui/src/markdown/attachmentTransformer.ts`
- Modify: `editor-ui/src/markdown/mindbaseTransformers.ts` (add to `MINDBASE_TRANSFORMERS`)
- Test: `editor-ui/src/markdown/attachmentTransformer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `editor-ui/src/markdown/attachmentTransformer.test.ts`:
```ts
import { createHeadlessEditor } from '@lexical/headless'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { $getRoot } from 'lexical'
import { describe, expect, it } from 'vitest'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import { MINDBASE_TOKEN_NODES } from '../nodes/mindbaseTokenNodes'
import { ImageNode, $isImageNode } from '../nodes/ImageNode'
import { FileCardNode, $isFileCardNode } from '../nodes/FileCardNode'
import { MINDBASE_TRANSFORMERS } from './mindbaseTransformers'

function roundTrip(markdown: string): { out: string; nodes: unknown[] } {
  const editor = createHeadlessEditor({
    namespace: 'test',
    nodes: [
      HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, CodeHighlightNode, LinkNode,
      ImageNode, FileCardNode, ...MINDBASE_TOKEN_NODES,
    ],
    onError: (e) => { throw e },
  })
  editor.update(() => $convertFromMarkdownString(markdown, MINDBASE_TRANSFORMERS), { discrete: true })
  let out = ''
  const nodes: unknown[] = []
  editor.getEditorState().read(() => {
    out = $convertToMarkdownString(MINDBASE_TRANSFORMERS)
    for (const p of $getRoot().getChildren()) {
      if ('getChildren' in (p as { getChildren?: unknown }) && typeof (p as { getChildren: () => unknown[] }).getChildren === 'function') {
        nodes.push(...(p as { getChildren: () => unknown[] }).getChildren())
      }
    }
  })
  return { out, nodes }
}

describe('attachment embed transformer', () => {
  it('imports image paths as ImageNode and round-trips losslessly', () => {
    const md = '![pic](welcome.attachments/photo.png)'
    const { out, nodes } = roundTrip(md)
    expect(nodes.some((n) => $isImageNode(n as never))).toBe(true)
    expect(out).toBe(md)
  })

  it('imports non-image paths as FileCardNode and round-trips losslessly', () => {
    const md = '![report.pdf](welcome.attachments/report.pdf)'
    const { out, nodes } = roundTrip(md)
    expect(nodes.some((n) => $isFileCardNode(n as never))).toBe(true)
    expect(out).toBe(md)
  })

  it('reads legacy bare filenames', () => {
    const { nodes } = roundTrip('![](photo.png)')
    expect(nodes.some((n) => $isImageNode(n as never))).toBe(true)
  })

  it('renders remote images as ImageNode', () => {
    const md = '![logo](https://example.com/logo.png)'
    const { out, nodes } = roundTrip(md)
    expect(nodes.some((n) => $isImageNode(n as never))).toBe(true)
    expect(out).toBe(md)
  })

  it('does not break plain links', () => {
    const md = '[label](https://example.com)'
    const { out } = roundTrip(md)
    expect(out).toBe(md)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd editor-ui && bun run test`
Expected: FAIL (transformer missing; image markdown stays plain text).

- [ ] **Step 3: Implement the transformer**

Create `editor-ui/src/markdown/attachmentTransformer.ts`:
```ts
import type { TextMatchTransformer } from '@lexical/markdown'
import { attachmentFilename, isImagePath } from '../attachments/host'
import { $createFileCardNode, $isFileCardNode, FileCardNode } from '../nodes/FileCardNode'
import { $createImageNode, $isImageNode, ImageNode } from '../nodes/ImageNode'

const EMBED_IMPORT = /!\[([^\]]*)\]\(([^()\s]+)\)/
const EMBED_TYPED = /!\[([^\]]*)\]\(([^()\s]+)\)$/

export const ATTACHMENT_EMBED: TextMatchTransformer = {
  dependencies: [ImageNode, FileCardNode],
  export: (node) => {
    if ($isImageNode(node)) {
      if (!node.getSrc()) return '' // pending upload — never persist
      return `![${node.getAlt()}](${node.getSrc()})`
    }
    if ($isFileCardNode(node)) {
      if (!node.getSrc()) return ''
      return `![${node.getLabel()}](${node.getSrc()})`
    }
    return null
  },
  importRegExp: EMBED_IMPORT,
  regExp: EMBED_TYPED,
  replace: (textNode, match) => {
    const alt = match[1]
    const src = match[2]
    const node = isImagePath(src)
      ? $createImageNode(src, alt)
      : $createFileCardNode(src, alt || attachmentFilename(src))
    textNode.replace(node)
  },
  trigger: ')',
  type: 'text-match',
}
```

In `editor-ui/src/markdown/mindbaseTransformers.ts`, add the import and put `ATTACHMENT_EMBED` **first** (it must win over the standard LINK transformer, which would otherwise match the `[alt](src)` tail of an image):
```ts
import { ATTACHMENT_EMBED } from './attachmentTransformer'
```
and change the last line to:
```ts
/** Standard GFM + Mindbase embeds, wiki links, tags, mentions, schedules. */
export const MINDBASE_TRANSFORMERS = [ATTACHMENT_EMBED, ...TRANSFORMERS, WIKI_LINK, TAG, MENTION, SCHEDULE]
```

- [ ] **Step 4: Run tests**

Run: `cd editor-ui && bun run test`
Expected: all pass. If "plain links" fails because ATTACHMENT_EMBED ran on a non-image markdown link, the regex is wrong — it must require the leading `!`.

- [ ] **Step 5: Commit**

```bash
git add editor-ui/src/markdown/
git commit -m "feat(editor-ui): markdown transformer mapping ![alt](src) to embed nodes"
```

---

### Task 5: AttachmentPlugin — paste/drop upload + insert command

**Files:**
- Create: `editor-ui/src/plugins/AttachmentPlugin.tsx`
- Modify: `editor-ui/src/bridge.ts`
- Test: `editor-ui/src/plugins/attachmentInsert.test.ts`

- [ ] **Step 1: Extend the bridge types**

In `editor-ui/src/bridge.ts`:

Add to the `BridgeMessage` union:
```ts
  | { type: 'attachment-uploaded'; path: string }
  | { type: 'attachment-error'; message: string }
```

Add to the `declare global { interface Window {` block:
```ts
    mindbaseInsertAttachment?: (path: string) => void
    mindbaseAttachmentHost?: import('./attachments/host').AttachmentHost
```

- [ ] **Step 2: Write the failing test for the pure insert helper**

Create `editor-ui/src/plugins/attachmentInsert.test.ts`:
```ts
import { createHeadlessEditor } from '@lexical/headless'
import { $getRoot } from 'lexical'
import { describe, expect, it } from 'vitest'
import { FileCardNode } from '../nodes/FileCardNode'
import { ImageNode } from '../nodes/ImageNode'
import { $insertAttachmentNode } from './AttachmentPlugin'

function makeEditor() {
  return createHeadlessEditor({
    namespace: 'test',
    nodes: [ImageNode, FileCardNode],
    onError: (e) => { throw e },
  })
}

describe('$insertAttachmentNode', () => {
  it('inserts an ImageNode for image paths', () => {
    const editor = makeEditor()
    editor.update(() => {
      $insertAttachmentNode('x.attachments/a.png')
    }, { discrete: true })
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe('')
      expect(JSON.stringify(editor.getEditorState().toJSON())).toContain('mb-image')
    })
  })

  it('inserts a FileCardNode with filename label for other paths', () => {
    const editor = makeEditor()
    editor.update(() => {
      $insertAttachmentNode('x.attachments/r.pdf')
    }, { discrete: true })
    editor.getEditorState().read(() => {
      const json = JSON.stringify(editor.getEditorState().toJSON())
      expect(json).toContain('mb-file-card')
      expect(json).toContain('"label":"r.pdf"')
    })
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `cd editor-ui && bun run test`
Expected: FAIL — `AttachmentPlugin` module missing.

- [ ] **Step 4: Implement the plugin**

Create `editor-ui/src/plugins/AttachmentPlugin.tsx`:
```tsx
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { DRAG_DROP_PASTE } from '@lexical/rich-text'
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  createCommand,
  type LexicalCommand,
  type LexicalNode,
} from 'lexical'
import { useEffect } from 'react'
import { attachmentFilename, isImagePath, useAttachmentHost } from '../attachments/host'
import { postBridge } from '../bridge'
import { $createFileCardNode, $isFileCardNode, FileCardNode } from '../nodes/FileCardNode'
import { $createImageNode, $isImageNode, ImageNode } from '../nodes/ImageNode'

export const INSERT_ATTACHMENT_COMMAND: LexicalCommand<{ path: string; label?: string }> =
  createCommand('INSERT_ATTACHMENT_COMMAND')

function $insertInline(node: LexicalNode) {
  const selection = $getSelection()
  if ($isRangeSelection(selection)) {
    selection.insertNodes([node])
    return
  }
  const root = $getRoot()
  const last = root.getLastChild()
  if (last && 'append' in last && typeof (last as { append?: unknown }).append === 'function') {
    ;(last as unknown as { append: (n: LexicalNode) => void }).append(node)
  } else {
    const p = $createParagraphNode()
    p.append(node)
    root.append(p)
  }
}

/** Insert an ImageNode or FileCardNode (by extension) at the selection. Must run inside editor.update(). */
export function $insertAttachmentNode(path: string, label?: string): ImageNode | FileCardNode {
  const node = isImagePath(path)
    ? $createImageNode(path, label ?? '')
    : $createFileCardNode(path, label ?? attachmentFilename(path))
  $insertInline(node)
  return node
}

export function AttachmentPlugin() {
  const [editor] = useLexicalComposerContext()
  const host = useAttachmentHost()

  useEffect(() => {
    window.mindbaseInsertAttachment = (path: string) => {
      editor.dispatchCommand(INSERT_ATTACHMENT_COMMAND, { path })
    }
    return () => {
      delete window.mindbaseInsertAttachment
    }
  }, [editor])

  useEffect(() => {
    return editor.registerCommand(
      INSERT_ATTACHMENT_COMMAND,
      ({ path, label }) => {
        editor.update(() => {
          $insertAttachmentNode(path, label)
        })
        return true
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor])

  useEffect(() => {
    if (!host) return
    return editor.registerCommand(
      DRAG_DROP_PASTE,
      (files: File[]) => {
        void (async () => {
          for (const file of files) {
            let pendingKey = ''
            editor.update(() => {
              const pending = isImagePath(file.name)
                ? $createImageNode('', file.name)
                : $createFileCardNode('', file.name)
              pendingKey = pending.getKey()
              $insertInline(pending)
            })
            try {
              const { path } = await host.upload(file)
              editor.update(() => {
                const node = $getNodeByKey(pendingKey)
                if ($isImageNode(node) || $isFileCardNode(node)) node.setSrc(path)
              })
              postBridge({ type: 'attachment-uploaded', path })
            } catch (err) {
              editor.update(() => {
                $getNodeByKey(pendingKey)?.remove()
              })
              postBridge({ type: 'attachment-error', message: String(err) })
            }
          }
        })()
        return true
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, host])

  return null
}
```

- [ ] **Step 5: Run tests**

Run: `cd editor-ui && bun run test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add editor-ui/src/plugins/AttachmentPlugin.tsx editor-ui/src/plugins/attachmentInsert.test.ts editor-ui/src/bridge.ts
git commit -m "feat(editor-ui): attachment plugin with drag-drop-paste upload and insert command"
```

---

### Task 6: Slash-command picker

**Files:**
- Modify: `editor-ui/src/slashCommands.ts`
- Modify: `editor-ui/src/plugins/SlashCommandPlugin.tsx`
- Create: `editor-ui/src/plugins/AttachmentPickerPlugin.tsx`
- Test: `editor-ui/src/slashCommands.test.ts`

- [ ] **Step 1: Write the failing test**

Create `editor-ui/src/slashCommands.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { slashCommandsFor } from './slashCommands'

describe('slash commands', () => {
  it('image and attachment commands open the picker instead of inserting text', () => {
    const cmds = slashCommandsFor('note')
    const image = cmds.find((c) => c.id === 'image')
    const attachment = cmds.find((c) => c.id === 'attachment')
    expect(image?.picker).toBe(true)
    expect(image?.insert).toBeUndefined()
    expect(attachment?.picker).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd editor-ui && bun run test`
Expected: FAIL — `picker` undefined / no `attachment` command.

- [ ] **Step 3: Update slashCommands.ts**

In the `SlashCommand` interface add:
```ts
  /** Opens the attachment picker (handled by AttachmentPickerPlugin). */
  picker?: boolean
```

Replace the `image` entry in `COMMON` with:
```ts
  { id: 'image', label: 'Image', hint: 'Embed an image', icon: '🖼', keywords: ['image', 'img', 'photo'], picker: true },
  { id: 'attachment', label: 'Attachment', hint: 'Embed a file', icon: '📎', keywords: ['attachment', 'file', 'upload', 'pdf'], picker: true },
```

- [ ] **Step 4: Dispatch from SlashCommandPlugin**

In `editor-ui/src/plugins/SlashCommandPlugin.tsx`, import:
```ts
import { OPEN_ATTACHMENT_PICKER_COMMAND } from './AttachmentPickerPlugin'
```
In `onSelectOption`, after the `editor.update(...)` block that removes the query text, replace `runSlashCommand(editor, selectedOption.command)` with:
```ts
      if (selectedOption.command.picker) {
        editor.dispatchCommand(OPEN_ATTACHMENT_PICKER_COMMAND, undefined)
      } else {
        runSlashCommand(editor, selectedOption.command)
      }
```

- [ ] **Step 5: Implement AttachmentPickerPlugin**

Create `editor-ui/src/plugins/AttachmentPickerPlugin.tsx`:
```tsx
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { COMMAND_PRIORITY_LOW, createCommand, type LexicalCommand } from 'lexical'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAttachmentHost, type AttachmentInfo } from '../attachments/host'
import { postBridge } from '../bridge'
import { INSERT_ATTACHMENT_COMMAND } from './AttachmentPlugin'

export const OPEN_ATTACHMENT_PICKER_COMMAND: LexicalCommand<void> = createCommand('OPEN_ATTACHMENT_PICKER_COMMAND')

export function AttachmentPickerPlugin() {
  const [editor] = useLexicalComposerContext()
  const host = useAttachmentHost()
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<AttachmentInfo[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return editor.registerCommand(
      OPEN_ATTACHMENT_PICKER_COMMAND,
      () => {
        if (!host) return false
        void host.list().then((f) => {
          setFiles(f)
          setOpen(true)
        })
        return true
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, host])

  if (!open || !host) return null

  const insert = (path: string, label: string) => {
    editor.dispatchCommand(INSERT_ATTACHMENT_COMMAND, { path, label })
    setOpen(false)
  }

  const uploadAndInsert = async (file: File) => {
    try {
      const { path } = await host.upload(file)
      postBridge({ type: 'attachment-uploaded', path })
      insert(path, file.name)
    } catch (err) {
      postBridge({ type: 'attachment-error', message: String(err) })
      setOpen(false)
    }
  }

  return createPortal(
    <div className="mb-attach-picker-backdrop" onClick={() => setOpen(false)}>
      <div className="mb-attach-picker" role="dialog" aria-label="Insert attachment" onClick={(e) => e.stopPropagation()}>
        <div className="mb-attach-picker-title">Insert attachment</div>
        <div className="mb-attach-picker-list">
          {files.length === 0 && <div className="mb-attach-picker-empty">No attachments yet</div>}
          {files.map((f) => (
            <button key={f.path} type="button" className="mb-attach-picker-item" onClick={() => insert(f.path, f.name)}>
              {f.name}
            </button>
          ))}
        </div>
        <div className="mb-attach-picker-actions">
          <input
            ref={inputRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void uploadAndInsert(f)
              e.target.value = ''
            }}
          />
          <button type="button" className="mb-attach-picker-upload" onClick={() => inputRef.current?.click()}>
            Upload file…
          </button>
          <button type="button" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 6: Run tests, typecheck**

Run: `cd editor-ui && bun run test && bun run typecheck`
Expected: tests pass; no type errors.

- [ ] **Step 7: Commit**

```bash
git add editor-ui/src/slashCommands.ts editor-ui/src/slashCommands.test.ts editor-ui/src/plugins/SlashCommandPlugin.tsx editor-ui/src/plugins/AttachmentPickerPlugin.tsx
git commit -m "feat(editor-ui): attachment picker via /image and /attachment slash commands"
```

---

### Task 7: Wire EditorApp + styles

**Files:**
- Modify: `editor-ui/src/EditorApp.tsx`
- Modify: `editor-ui/src/editor.css`

- [ ] **Step 1: EditorApp changes**

In `editor-ui/src/EditorApp.tsx`:

Add imports:
```ts
import { AttachmentHostContext, type AttachmentHost } from './attachments/host'
import { FileCardNode } from './nodes/FileCardNode'
import { ImageNode } from './nodes/ImageNode'
import { AttachmentPickerPlugin } from './plugins/AttachmentPickerPlugin'
import { AttachmentPlugin } from './plugins/AttachmentPlugin'
```

Extend props:
```ts
interface Props {
  initialMarkdown: string
  documentKind?: SlashDocumentKind
  attachmentHost?: AttachmentHost
}
```
and the signature: `export function EditorApp({ initialMarkdown, documentKind = 'note', attachmentHost }: Props) {`

Add `ImageNode, FileCardNode,` to the `nodes:` array (after `LinkNode,`).

Wrap the JSX directly inside `<LexicalComposer ...>` with the provider, and mount the plugins next to `<BridgePlugin />`:
```tsx
      <AttachmentHostContext.Provider value={attachmentHost ?? null}>
        <div className="mindbase-immersive">
          ...existing children...
          <AttachmentPlugin />
          <AttachmentPickerPlugin />
        </div>
      </AttachmentHostContext.Provider>
```

- [ ] **Step 2: Styles**

Append to `editor-ui/src/editor.css`:
```css
/* Attachment embeds */
.mb-embed { display: inline-block; max-width: 100%; vertical-align: middle; }
.mb-embed-image { max-width: 100%; max-height: 480px; border-radius: 8px; display: block; }
.mb-embed-image-broken { min-width: 120px; min-height: 40px; background: rgba(0, 0, 0, 0.06); }
.mb-attachment-pending {
  display: inline-block;
  padding: 0.2em 0.6em;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.06);
  font-style: italic;
  opacity: 0.75;
}
.mb-file-card {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.3em 0.7em;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.55);
  text-decoration: none;
  color: inherit;
}
.mb-file-card:hover { border-color: rgba(0, 0, 0, 0.3); }
.mb-file-card-label { font-size: 0.92em; }

/* Attachment picker */
.mb-attach-picker-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}
.mb-attach-picker {
  width: min(420px, 92vw);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: #fffdf8;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  padding: 0.9rem;
}
.mb-attach-picker-title { font-weight: 600; margin-bottom: 0.6rem; }
.mb-attach-picker-list { overflow-y: auto; display: flex; flex-direction: column; gap: 0.25rem; }
.mb-attach-picker-item,
.mb-attach-picker-upload,
.mb-attach-picker-actions button {
  font: inherit;
  text-align: left;
  padding: 0.45rem 0.6rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}
.mb-attach-picker-item:hover, .mb-attach-picker-upload:hover { background: rgba(0, 0, 0, 0.05); }
.mb-attach-picker-empty { opacity: 0.6; padding: 0.45rem 0.6rem; }
.mb-attach-picker-actions { display: flex; gap: 0.5rem; margin-top: 0.6rem; justify-content: flex-end; }
```

- [ ] **Step 3: Build both bundles to prove integration compiles**

Run: `cd editor-ui && bun run typecheck && cd .. && bun run editor-ui:build && bun run web:build`
Expected: both builds succeed.

- [ ] **Step 4: Commit**

```bash
git add editor-ui/src/EditorApp.tsx editor-ui/src/editor.css
git commit -m "feat(editor-ui): register embed nodes, attachment plugins, and styles"
```

---

### Task 8: Web host adapter + NoteView integration

**Files:**
- Modify: `web/src/components/LexicalEditor.tsx`
- Modify: `web/src/components/NoteView.tsx`
- Modify: `web/src/components/MarkdownEditor.tsx`

- [ ] **Step 1: LexicalEditor — build and pass the host**

Replace `web/src/components/LexicalEditor.tsx` content with:
```tsx
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { EditorApp } from '@mindbase/editor-ui/EditorApp'
import type { BridgeMessage } from '@mindbase/editor-ui/bridge'
import {
  attachmentMarkdownPath,
  resolveApiUrl,
  type AttachmentHost,
} from '@mindbase/editor-ui/attachments/host'
import { api } from '../api'
import '@mindbase/editor-ui/editor.css'

interface Props {
  value: string
  notePath: string
  onChange: (markdown: string) => void
}

/** Lexical rich-text editor — markdown in/out, shared with mobile/macOS WebView shell. */
export const LexicalEditor = memo(function LexicalEditor({ value, notePath, onChange }: Props) {
  const lastEmitted = useRef(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const attachmentHost = useMemo<AttachmentHost>(
    () => ({
      upload: async (file) => {
        const entry = await api.attachments.upload(notePath, file)
        return { path: attachmentMarkdownPath(notePath, entry.name) }
      },
      resolveUrl: (path) => resolveApiUrl(notePath, path),
      list: async () => {
        const entries = await api.attachments.list(notePath)
        return entries.map((a) => ({ name: a.name, path: attachmentMarkdownPath(notePath, a.name) }))
      },
    }),
    [notePath],
  )

  const handleBridge = useCallback((event: Event) => {
    const msg = (event as CustomEvent<BridgeMessage>).detail
    if (msg?.type === 'change' && typeof msg.markdown === 'string') {
      if (msg.markdown === lastEmitted.current) return
      lastEmitted.current = msg.markdown
      onChangeRef.current(msg.markdown)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('mindbase-editor', handleBridge)
    return () => window.removeEventListener('mindbase-editor', handleBridge)
  }, [handleBridge])

  useEffect(() => {
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    window.mindbaseSetMarkdown?.(value)
  }, [value])

  return (
    <div className="lexical-editor-host">
      <EditorApp initialMarkdown={value} attachmentHost={attachmentHost} />
    </div>
  )
})
```

- [ ] **Step 2: MarkdownEditor — expose cursor insert (and fix the dark theme leftover)**

Replace `web/src/components/MarkdownEditor.tsx` content with:
```tsx
import { forwardRef, useImperativeHandle, useRef } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'

interface Props {
  value: string
  onChange: (value: string) => void
}

export interface MarkdownEditorHandle {
  insertText: (text: string) => void
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor(
  { value, onChange },
  ref,
) {
  const cmRef = useRef<ReactCodeMirrorRef>(null)

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      const view = cmRef.current?.view
      if (!view) return
      const pos = view.state.selection.main.head
      view.dispatch({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length } })
      view.focus()
    },
  }))

  return (
    <CodeMirror
      ref={cmRef}
      value={value}
      height="100%"
      extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
      onChange={onChange}
      className="markdown-editor"
    />
  )
})
```
(Note: this also drops `theme="dark"`, a leftover from the removed dark theme.)

- [ ] **Step 3: NoteView — pass notePath, refresh on upload, Insert buttons**

In `web/src/components/NoteView.tsx`:

Add to imports: `CornerDownLeft` from `lucide-react`, the handle type, and the path helper:
```ts
import { Save, Trash2, Upload, Eye, Edit3, FileCode2, CornerDownLeft } from 'lucide-react'
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor'
import { attachmentMarkdownPath } from '@mindbase/editor-ui/attachments/host'
```
(Replace the existing `import { MarkdownEditor } from './MarkdownEditor'` line.)

Add a ref near `fileRef`:
```ts
  const mdRef = useRef<MarkdownEditorHandle>(null)
```

Add a bridge listener effect (after the WS effect) that refreshes the panel when the editor uploads:
```ts
  useEffect(() => {
    const onBridge = (event: Event) => {
      const msg = (event as CustomEvent<{ type?: string }>).detail
      if (msg?.type === 'attachment-uploaded') {
        api.attachments.list(path).then(setAttachments).catch(() => {})
      }
    }
    window.addEventListener('mindbase-editor', onBridge)
    return () => window.removeEventListener('mindbase-editor', onBridge)
  }, [path])
```

Add the insert handler (after `upload`):
```ts
  const insertAttachment = (name: string) => {
    const mdPath = attachmentMarkdownPath(path, name)
    if (mode === 'markdown' || mode === 'split') {
      mdRef.current?.insertText(`![](${mdPath})`)
      return
    }
    window.mindbaseInsertAttachment?.(mdPath)
  }
```

Update the two component usages:
- `<LexicalEditor value={content} onChange={setContent} />` → `<LexicalEditor value={content} notePath={path} onChange={setContent} />`
- `{mode === 'markdown' && <MarkdownEditor value={content} onChange={setContent} />}` → `{mode === 'markdown' && <MarkdownEditor ref={mdRef} value={content} onChange={setContent} />}`

In the attachments list `<li>`, add the Insert button before the `<a>`:
```tsx
            <li key={a.name}>
              <button
                type="button"
                className="icon-btn"
                title="Insert into note"
                onClick={() => insertAttachment(a.name)}
              >
                <CornerDownLeft size={14} />
              </button>
              <a href={api.attachments.url(path, a.name)} target="_blank" rel="noreferrer">
                {a.name}
              </a>
              <small>{(a.size / 1024).toFixed(1)} KB</small>
            </li>
```

- [ ] **Step 4: Typecheck + build**

Run: `cd web && bunx tsc --noEmit && cd .. && bun run web:build`
Expected: no type errors, build succeeds. (`window.mindbaseInsertAttachment` is declared globally by `editor-ui/src/bridge.ts`, which is in the web tsconfig include path via the alias.)

- [ ] **Step 5: Commit**

```bash
git add web/src/components/LexicalEditor.tsx web/src/components/MarkdownEditor.tsx web/src/components/NoteView.tsx
git commit -m "feat(web): attachment host adapter, panel insert buttons, upload refresh"
```

---

### Task 9: MarkdownPreview path resolution

**Files:**
- Modify: `web/src/components/MarkdownPreview.tsx`

- [ ] **Step 1: Use the shared resolver**

In `web/src/components/MarkdownPreview.tsx` add:
```ts
import { resolveApiUrl } from '@mindbase/editor-ui/attachments/host'
```
and replace the `img` component body with:
```tsx
          img({ src, alt, ...props }) {
            let resolved = src
            if (notePath && src && !src.startsWith('http') && !src.startsWith('/api/')) {
              resolved = resolveApiUrl(notePath, src)
            }
            return <img src={resolved} alt={alt ?? ''} {...props} />
          },
```
This handles both `welcome.attachments/photo.png` and legacy `photo.png`/`./photo.png` forms (the resolver keeps only the filename).

- [ ] **Step 2: Typecheck + build**

Run: `cd web && bunx tsc --noEmit && cd .. && bun run web:build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/MarkdownPreview.tsx
git commit -m "fix(web): resolve sibling-relative attachment paths in markdown preview"
```

---

### Task 10: End-to-end verification

**Files:**
- Create: `/tmp/mb-drive/attachments-e2e.mjs` (throwaway driver, not committed)

- [ ] **Step 1: Rebuild the served bundle and start the server**

```bash
bun run web:build && rm -rf internal/webui/dist && cp -R web/dist internal/webui/dist && go build -o bin/mindbase ./cmd/mindbase
./bin/mindbase -vault ./vault -addr :8780 -ui react &   # or run_in_background
```

- [ ] **Step 2: Drive the full flow with Playwright**

Create `/tmp/mb-drive/attachments-e2e.mjs` (the `/tmp/mb-drive` dir already has `playwright-core` installed and `shot.mjs` shows the executable path pattern):
```js
import { chromium } from 'playwright-core'
import os from 'os'
import path from 'path'
import fs from 'fs'

const exe = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell')
// 1x1 red PNG
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
fs.writeFileSync('/tmp/mb-drive/e2e-pixel.png', png)

const browser = await chromium.launch({ executablePath: exe, headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto('http://localhost:8780/notes/welcome.md', { waitUntil: 'networkidle' })

// Upload via the attachments panel
await page.setInputFiles('.attachments-panel input[type=file]', '/tmp/mb-drive/e2e-pixel.png')
await page.waitForSelector('.attachments-panel a:has-text("e2e-pixel.png")')

// Insert into the rich editor from the panel
await page.click('.attachments-panel li:has(a:has-text("e2e-pixel.png")) button[title="Insert into note"]')
await page.waitForSelector('.lexical-editor-host img.mb-embed-image')
console.log('inline image rendered ✓')

// Markdown round-trip: switch to markdown mode and look for the portable path
await page.click('button[title="Markdown source"]')
await page.waitForSelector('.markdown-editor')
const text = await page.evaluate(() => document.querySelector('.markdown-editor .cm-content')?.textContent ?? '')
if (!text.includes('![](welcome.attachments/e2e-pixel.png)') && !text.includes('](welcome.attachments/e2e-pixel.png)')) {
  throw new Error('markdown does not contain portable attachment path: ' + text.slice(0, 400))
}
console.log('markdown contains portable path ✓')

await page.screenshot({ path: '/tmp/mb-drive/e2e-attachments.png' })
if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1) }
console.log('e2e OK')
await browser.close()
```

Run: `cd /tmp/mb-drive && bun attachments-e2e.mjs`
Expected output: the three ✓ lines and `e2e OK`. Also Read `/tmp/mb-drive/e2e-attachments.png` and visually confirm the editor shows the embed.

- [ ] **Step 3: Verify slash picker manually via script (optional but recommended)**

In the same driver or a follow-up: focus the editor, type `/attach`, assert `.mb-slash-item` appears, press Enter, assert `.mb-attach-picker` dialog lists `e2e-pixel.png`.

- [ ] **Step 4: Clean up test data and stop the server**

```bash
pkill -f "bin/mindbase -vault"
rm -rf vault/notes/welcome.attachments   # remove e2e upload from the local vault
```

- [ ] **Step 5: Run the full test suite one last time**

```bash
cd editor-ui && bun run test && bun run typecheck && cd ../web && bunx tsc --noEmit && cd .. && go test ./... && bun run editor-ui:build && bun run web:build
```
Expected: everything green.

- [ ] **Step 6: Final commit (bundle refresh)**

```bash
git add -A internal/editor/lexical
git commit -m "build: refresh embedded lexical editor bundle with attachment embeds"
```

---

## Self-review notes (already applied)

- Spec coverage: adapter (T2/T7/T8), nodes+markdown (T3/T4), paste/drop (T5), slash picker (T6), panel insert (T8), preview paths (T9), error placeholders (T5), tests (T1–T6, T10). Mobile upload flows are explicitly out of scope per spec.
- The ATTACHMENT_EMBED transformer must precede the standard LINK transformer — locked into Task 4 with a test guarding it.
- `attachmentMarkdownPath`/`resolveApiUrl` names are consistent across Tasks 2, 8, 9.
