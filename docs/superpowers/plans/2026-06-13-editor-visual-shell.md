# Editor Visual Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document outline in the sidebar, richer floating toolbar (link/style/highlight), slim stats footer absorbing the attachments panel, and a toggleable stubbed comments rail — per `docs/superpowers/specs/2026-06-13-editor-visual-shell-design.md`.

**Architecture:** `editor-ui` emits document structure over the existing bridge (`outline` messages + `mindbaseScrollToHeading`); all chrome (OutlinePanel, EditorFooter, CommentsRail) lives in `web`. No server changes.

**Tech Stack:** Lexical 0.31 (HeadingNode traversal, `$setBlocksType`, `TOGGLE_LINK_COMMAND`, native `highlight` format — `@lexical/markdown` round-trips `==x==` out of the box), React 18, vitest + @lexical/headless (already set up in editor-ui), existing bridge/CustomEvent pattern.

**Conventions:** repo root `/Users/osarogie/mindbase`, branch `feature/editor-shell`, package manager bun. Web imports editor-ui via `@mindbase/editor-ui/*` → `editor-ui/src/*`. Never commit `internal/editor/lexical/*`, `internal/webui/dist`, `internal/ui/static/tw.css`, or `.serena/` unless a task says so. Verify per task: `cd editor-ui && bun run test && bun run typecheck`, `cd web && bunx tsc --noEmit`, root `bun run editor-ui:build && bun run web:build`.

---

### Task 1: OutlinePlugin + bridge + reading time helper (editor-ui)

**Files:**
- Create: `editor-ui/src/plugins/OutlinePlugin.tsx`
- Modify: `editor-ui/src/bridge.ts`
- Modify: `editor-ui/src/textStats.ts`
- Modify: `editor-ui/src/EditorApp.tsx` (mount plugin)
- Test: `editor-ui/src/plugins/outline.test.ts`, `editor-ui/src/textStats.test.ts`

- [ ] **Step 1: failing tests**

Create `editor-ui/src/plugins/outline.test.ts`:
```ts
import { createHeadlessEditor } from '@lexical/headless'
import { $convertFromMarkdownString } from '@lexical/markdown'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import { describe, expect, it } from 'vitest'
import { MINDBASE_TOKEN_NODES } from '../nodes/mindbaseTokenNodes'
import { ImageNode } from '../nodes/ImageNode'
import { FileCardNode } from '../nodes/FileCardNode'
import { MINDBASE_TRANSFORMERS } from '../markdown/mindbaseTransformers'
import { $collectOutline } from './OutlinePlugin'

function outlineOf(markdown: string) {
  const editor = createHeadlessEditor({
    namespace: 'test',
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, CodeHighlightNode, LinkNode, ImageNode, FileCardNode, ...MINDBASE_TOKEN_NODES],
    onError: (e) => { throw e },
  })
  editor.update(() => $convertFromMarkdownString(markdown, MINDBASE_TRANSFORMERS), { discrete: true })
  let result: ReturnType<typeof $collectOutline> = []
  editor.getEditorState().read(() => { result = $collectOutline() })
  return result
}

describe('$collectOutline', () => {
  it('collects H1-H3 in document order with levels and text', () => {
    const o = outlineOf('# One\n\ntext\n\n## Two\n\n### Three\n\n## Four')
    expect(o.map((h) => [h.level, h.text])).toEqual([[1, 'One'], [2, 'Two'], [3, 'Three'], [2, 'Four']])
    expect(new Set(o.map((h) => h.key)).size).toBe(4)
  })
  it('ignores H4+ and non-headings', () => {
    const o = outlineOf('#### Deep\n\nparagraph\n\n> quote\n\n## Kept')
    expect(o.map((h) => h.text)).toEqual(['Kept'])
  })
  it('returns empty for headingless documents', () => {
    expect(outlineOf('just text')).toEqual([])
  })
})
```

Append to `editor-ui/src/textStats.test.ts` (create the file if missing — check first; if `countWords` tests exist keep them):
```ts
import { describe, expect, it } from 'vitest'
import { readingTimeMinutes } from './textStats'

describe('readingTimeMinutes', () => {
  it('returns 0 for empty documents', () => expect(readingTimeMinutes(0)).toBe(0))
  it('rounds up at 225 wpm with a 1-minute floor', () => {
    expect(readingTimeMinutes(1)).toBe(1)
    expect(readingTimeMinutes(225)).toBe(1)
    expect(readingTimeMinutes(226)).toBe(2)
    expect(readingTimeMinutes(1496)).toBe(7)
  })
})
```

- [ ] **Step 2: run, confirm FAIL** — `cd editor-ui && bun run test` (missing module / missing export).

- [ ] **Step 3: implement**

Append to `editor-ui/src/textStats.ts`:
```ts
/** Reading time at 225 wpm: 0 for empty docs, otherwise ceil with a 1-minute floor. */
export function readingTimeMinutes(words: number): number {
  if (words <= 0) return 0
  return Math.max(1, Math.ceil(words / 225))
}
```

Create `editor-ui/src/plugins/OutlinePlugin.tsx`:
```tsx
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $isHeadingNode } from '@lexical/rich-text'
import { $getRoot } from 'lexical'
import { useEffect } from 'react'
import { postBridge } from '../bridge'

export interface OutlineHeading {
  key: string
  text: string
  level: 1 | 2 | 3
}

/** Collect H1–H3 top-level headings in document order. Must run inside an editor state read/update. */
export function $collectOutline(): OutlineHeading[] {
  const headings: OutlineHeading[] = []
  for (const node of $getRoot().getChildren()) {
    if (!$isHeadingNode(node)) continue
    const tag = node.getTag()
    if (tag !== 'h1' && tag !== 'h2' && tag !== 'h3') continue
    headings.push({ key: node.getKey(), text: node.getTextContent(), level: Number(tag[1]) as 1 | 2 | 3 })
  }
  return headings
}

const OUTLINE_DEBOUNCE_MS = 280

export function OutlinePlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let last = ''
    const emit = () => {
      editor.getEditorState().read(() => {
        const headings = $collectOutline()
        const fingerprint = JSON.stringify(headings)
        if (fingerprint === last) return
        last = fingerprint
        postBridge({ type: 'outline', headings })
      })
    }
    emit()
    const unregister = editor.registerUpdateListener(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(emit, OUTLINE_DEBOUNCE_MS)
    })
    return () => {
      if (timer) clearTimeout(timer)
      unregister()
    }
  }, [editor])

  useEffect(() => {
    window.mindbaseScrollToHeading = (key: string) => {
      // Stale keys (heading deleted between debounce ticks) resolve to null — no-op per spec.
      const el = editor.getElementByKey(key)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    return () => {
      delete window.mindbaseScrollToHeading
    }
  }, [editor])

  return null
}
```

In `editor-ui/src/bridge.ts` add to the `BridgeMessage` union:
```ts
  | { type: 'outline'; headings: { key: string; text: string; level: 1 | 2 | 3 }[] }
```
and to the `declare global` Window block:
```ts
    mindbaseScrollToHeading?: (key: string) => void
```

In `editor-ui/src/EditorApp.tsx`: import `{ OutlinePlugin } from './plugins/OutlinePlugin'` and mount `<OutlinePlugin />` next to the other plugins (e.g. after `<AttachmentPlugin />`).

- [ ] **Step 4: verify** — `cd editor-ui && bun run test && bun run typecheck`. All pass.

- [ ] **Step 5: commit**
```bash
git add editor-ui/src/plugins/OutlinePlugin.tsx editor-ui/src/plugins/outline.test.ts editor-ui/src/bridge.ts editor-ui/src/textStats.ts editor-ui/src/textStats.test.ts editor-ui/src/EditorApp.tsx
git commit -m "feat(editor-ui): outline bridge events, scroll-to-heading, reading time"
```

---

### Task 2: Floating toolbar — link, style dropdown, highlight (editor-ui)

**Files:**
- Modify: `editor-ui/src/plugins/FloatingToolbarPlugin.tsx`
- Modify: `editor-ui/src/editor.css`
- Test: `editor-ui/src/plugins/toolbarBlocks.test.ts`

- [ ] **Step 1: failing tests**

Create `editor-ui/src/plugins/toolbarBlocks.test.ts`:
```ts
import { createHeadlessEditor } from '@lexical/headless'
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { $getRoot, $createRangeSelection, $setSelection } from 'lexical'
import { describe, expect, it } from 'vitest'
import { $applyBlockStyle, type BlockStyle } from './FloatingToolbarPlugin'

function editorWith(markdown: string) {
  const editor = createHeadlessEditor({
    namespace: 'test',
    nodes: [HeadingNode, QuoteNode],
    onError: (e) => { throw e },
  })
  editor.update(() => $convertFromMarkdownString(markdown, TRANSFORMERS), { discrete: true })
  return editor
}

function applyAndExport(markdown: string, style: BlockStyle): string {
  const editor = editorWith(markdown)
  editor.update(() => {
    const first = $getRoot().getFirstChild()
    if (!first) throw new Error('empty doc')
    const sel = $createRangeSelection()
    sel.anchor.set(first.getKey(), 0, 'element')
    sel.focus.set(first.getKey(), 0, 'element')
    $setSelection(sel)
    $applyBlockStyle(style)
  }, { discrete: true })
  let out = ''
  editor.getEditorState().read(() => { out = $convertToMarkdownString(TRANSFORMERS) })
  return out
}

describe('$applyBlockStyle', () => {
  it('converts a paragraph to each heading level and quote', () => {
    expect(applyAndExport('hello', 'h1')).toBe('# hello')
    expect(applyAndExport('hello', 'h2')).toBe('## hello')
    expect(applyAndExport('hello', 'h3')).toBe('### hello')
    expect(applyAndExport('hello', 'quote')).toBe('> hello')
  })
  it('converts a heading back to a paragraph', () => {
    expect(applyAndExport('## hello', 'paragraph')).toBe('hello')
  })
})

describe('highlight markdown round-trip (library behavior we rely on)', () => {
  it('==x== survives import/export', () => {
    const editor = editorWith('==marked== text')
    let out = ''
    editor.getEditorState().read(() => { out = $convertToMarkdownString(TRANSFORMERS) })
    expect(out).toBe('==marked== text')
  })
})
```

- [ ] **Step 2: run, confirm FAIL** — `$applyBlockStyle` not exported.

- [ ] **Step 3: implement**

In `editor-ui/src/plugins/FloatingToolbarPlugin.tsx`:

Add imports:
```ts
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { $createParagraphNode, $isElementNode } from 'lexical'
```

Extend the inline formats:
```ts
type InlineFormat = Extract<TextFormatType, 'bold' | 'italic' | 'strikethrough' | 'code' | 'highlight'>

const TOOLBAR_ACTIONS: { format: InlineFormat; label: string; title: string }[] = [
  { format: 'bold', label: 'B', title: 'Bold' },
  { format: 'italic', label: 'I', title: 'Italic' },
  { format: 'strikethrough', label: 'S', title: 'Strikethrough' },
  { format: 'highlight', label: '==', title: 'Highlight' },
  { format: 'code', label: '</>', title: 'Inline code' },
]
```
(update the `activeFormats` initial state and the `formats` object inside `reposition` to include `highlight: selection.hasFormat('highlight')` — and `formats` reset literal gets `highlight: false`.)

Add the exported block-style helper (module level, above the component):
```ts
export type BlockStyle = 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote'

/** Apply a block style to the current selection. Must run inside editor.update(). */
export function $applyBlockStyle(style: BlockStyle) {
  const selection = $getSelection()
  if (style === 'paragraph') {
    $setBlocksType(selection, () => $createParagraphNode())
  } else if (style === 'quote') {
    $setBlocksType(selection, () => $createQuoteNode())
  } else {
    $setBlocksType(selection, () => $createHeadingNode(style))
  }
}
```

Inside the component add state + detection:
```ts
const [blockStyle, setBlockStyle] = useState<BlockStyle>('paragraph')
const [isLink, setIsLink] = useState(false)
const [linkEditing, setLinkEditing] = useState(false)
const [linkUrl, setLinkUrl] = useState('')
```
In `reposition`'s `read()` block, after computing `formats`, derive the block style and link state:
```ts
const anchorNode = selection.anchor.getNode()
const top = anchorNode.getTopLevelElement()
let style: BlockStyle = 'paragraph'
if ($isHeadingNode(top)) {
  const tag = top.getTag()
  style = tag === 'h1' || tag === 'h2' || tag === 'h3' ? tag : 'paragraph'
} else if ($isQuoteNode(top)) {
  style = 'quote'
}
const parent = anchorNode.getParent()
const linked = $isLinkNode(parent) || ($isElementNode(anchorNode) && $isLinkNode(anchorNode))
```
Store via `setBlockStyle(style)` / `setIsLink(linked)` next to `setActiveFormats(formats)` (hoist them out of the read the same way `formats` is). When the toolbar hides, also `setLinkEditing(false)`.

Render, before the format buttons, a style dropdown; after them, the link button; and when `linkEditing`, an URL input row appended below the buttons:
```tsx
<select
  className="mb-floating-toolbar-select"
  value={blockStyle}
  title="Text style"
  aria-label="Text style"
  onMouseDown={(e) => e.stopPropagation()}
  onChange={(e) => {
    const style = e.target.value as BlockStyle
    editor.update(() => $applyBlockStyle(style))
    requestAnimationFrame(reposition)
  }}
>
  <option value="paragraph">Text</option>
  <option value="h1">Heading 1</option>
  <option value="h2">Heading 2</option>
  <option value="h3">Heading 3</option>
  <option value="quote">Quote</option>
</select>
```
```tsx
<button
  type="button"
  className={`mb-floating-toolbar-btn ${isLink ? 'is-active' : ''}`}
  title="Link"
  aria-label="Link"
  aria-pressed={isLink}
  onMouseDown={(e) => e.preventDefault()}
  onClick={() => {
    if (isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
      setLinkEditing(false)
    } else {
      setLinkUrl('')
      setLinkEditing(true)
    }
  }}
>
  🔗
</button>
```
```tsx
{linkEditing && (
  <form
    className="mb-floating-toolbar-linkrow"
    onSubmit={(e) => {
      e.preventDefault()
      const url = linkUrl.trim()
      if (url) editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
      setLinkEditing(false)
    }}
  >
    <input
      autoFocus
      value={linkUrl}
      onChange={(e) => setLinkUrl(e.target.value)}
      placeholder="https://…"
      aria-label="Link URL"
    />
    <button type="submit">Set</button>
  </form>
)}
```
Wrap buttons row + link row in a column flex container inside the existing `.mb-floating-toolbar` div (a `.mb-floating-toolbar-row` div around the existing buttons) so the toolbar grows downward.

Append to `editor-ui/src/editor.css`:
```css
.mb-floating-toolbar-row { display: flex; align-items: center; gap: 2px; }
.mb-floating-toolbar-select {
  font: inherit;
  font-size: 0.85em;
  border: none;
  background: transparent;
  padding: 0.25rem;
  cursor: pointer;
}
.mb-floating-toolbar-linkrow { display: flex; gap: 4px; padding: 4px; }
.mb-floating-toolbar-linkrow input {
  font: inherit;
  font-size: 0.85em;
  padding: 0.2rem 0.4rem;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  min-width: 180px;
}
.mb-floating-toolbar-linkrow button { font: inherit; font-size: 0.85em; }
```
(Keep the existing `.mb-floating-toolbar` rules; restructure JSX so the existing buttons sit inside `.mb-floating-toolbar-row`.)

- [ ] **Step 4: verify** — `cd editor-ui && bun run test && bun run typecheck`; from root `bun run editor-ui:build`.

- [ ] **Step 5: commit**
```bash
git add editor-ui/src/plugins/FloatingToolbarPlugin.tsx editor-ui/src/plugins/toolbarBlocks.test.ts editor-ui/src/editor.css
git commit -m "feat(editor-ui): toolbar link button, block style dropdown, highlight"
```

---

### Task 3: OutlinePanel + sidebar outline mode (web)

**Files:**
- Create: `web/src/components/OutlinePanel.tsx`
- Modify: `web/src/components/Sidebar.tsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: OutlinePanel**

Create `web/src/components/OutlinePanel.tsx`:
```tsx
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

interface OutlineHeading {
  key: string
  text: string
  level: 1 | 2 | 3
}

interface Props {
  title: string
  onBack: () => void
}

/** Document outline shown in the sidebar while a note is open. Fed by 'outline' bridge events. */
export function OutlinePanel({ title, onBack }: Props) {
  const [headings, setHeadings] = useState<OutlineHeading[]>([])

  useEffect(() => {
    const onBridge = (event: Event) => {
      const msg = (event as CustomEvent<{ type?: string; headings?: OutlineHeading[] }>).detail
      if (msg?.type === 'outline' && Array.isArray(msg.headings)) setHeadings(msg.headings)
    }
    window.addEventListener('mindbase-editor', onBridge)
    return () => window.removeEventListener('mindbase-editor', onBridge)
  }, [])

  return (
    <div className="outline-panel">
      <button type="button" className="outline-back" onClick={onBack}>
        <ArrowLeft size={16} /> Library
      </button>
      <div className="outline-title">{title}</div>
      <div className="outline-label">Outline</div>
      {headings.length === 0 ? (
        <div className="outline-empty">No headings yet</div>
      ) : (
        <ul className="outline-list">
          {headings.map((h) => (
            <li key={h.key}>
              <button
                type="button"
                className={`outline-item level-${h.level}`}
                onClick={() => window.mindbaseScrollToHeading?.(h.key)}
              >
                {h.text || 'Untitled'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```
(`window.mindbaseScrollToHeading` is globally typed by editor-ui's bridge.)

- [ ] **Step 2: Sidebar mode switch**

In `web/src/components/Sidebar.tsx`: import `{ OutlinePanel } from './OutlinePanel'` and `useNavigate`/`useLocation` are already imported. Compute:
```ts
const noteRoutePath = location.pathname.startsWith('/notes/')
  ? decodeURIComponent(location.pathname.slice('/notes/'.length))
  : null
```
In the JSX, after `.sidebar-header`, when `noteRoutePath` is set render the outline INSTEAD of the tabs/lists/new buttons:
```tsx
{noteRoutePath ? (
  <OutlinePanel
    title={noteRoutePath.replace(/\.md$/, '').split('/').pop() ?? noteRoutePath}
    onBack={() => { navigate('/'); onToggle() }}
  />
) : (
  <>
    {/* existing view-tabs, new-note button, item lists, new-database button — unchanged, just wrapped */}
  </>
)}
```
Keep the existing children byte-identical inside the fragment.

- [ ] **Step 3: styles**

Append to `web/src/styles.css`:
```css
.outline-panel { display: flex; flex-direction: column; overflow-y: auto; flex: 1; padding: 0.75rem; gap: 0.25rem; }
.outline-back { justify-content: flex-start; background: transparent; border-color: transparent; }
.outline-back:hover { background: var(--surface-2); }
.outline-title { font-weight: 600; padding: 0.5rem 0.5rem 0.25rem; }
.outline-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted-foreground); padding: 0.25rem 0.5rem; }
.outline-empty { color: var(--muted-foreground); font-size: 0.85rem; padding: 0.25rem 0.5rem; }
.outline-list { list-style: none; margin: 0; padding: 0; }
.outline-list li { margin: 0; }
.outline-item { width: 100%; justify-content: flex-start; background: transparent; border-color: transparent; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.outline-item:hover { background: var(--surface-2); }
.outline-item.level-2 { padding-left: 1.5rem; }
.outline-item.level-3 { padding-left: 2.5rem; }
```

- [ ] **Step 4: verify** — `cd web && bunx tsc --noEmit`; root `bun run web:build`.

- [ ] **Step 5: commit**
```bash
git add web/src/components/OutlinePanel.tsx web/src/components/Sidebar.tsx web/src/styles.css
git commit -m "feat(web): sidebar document outline with back-to-library"
```

---

### Task 4: EditorFooter absorbing the attachments panel (web)

**Files:**
- Create: `web/src/components/EditorFooter.tsx`
- Modify: `web/src/components/NoteView.tsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: EditorFooter**

Create `web/src/components/EditorFooter.tsx`:
```tsx
import { CornerDownLeft, Paperclip, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { countStats, readingTimeMinutes } from '@mindbase/editor-ui/textStats'
import { api, AttachmentEntry } from '../api'

interface Props {
  notePath: string
  mode: 'rich' | 'markdown' | 'preview' | 'split'
  content: string
  attachments: AttachmentEntry[]
  saveState: string
  onInsert: (name: string) => void
  onUpload: (file: File) => void
}

export function EditorFooter({ notePath, mode, content, attachments, saveState, onInsert, onUpload }: Props) {
  const [bridgeStats, setBridgeStats] = useState({ words: 0, chars: 0 })
  const [expanded, setExpanded] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onBridge = (event: Event) => {
      const msg = (event as CustomEvent<{ type?: string; words?: number; chars?: number }>).detail
      if (msg?.type === 'stats' && typeof msg.words === 'number') {
        setBridgeStats({ words: msg.words, chars: msg.chars ?? 0 })
      }
    }
    window.addEventListener('mindbase-editor', onBridge)
    return () => window.removeEventListener('mindbase-editor', onBridge)
  }, [])

  // Rich/split render the Lexical editor (bridge stats); markdown/preview compute from content.
  const words = mode === 'rich' || mode === 'split' ? bridgeStats.words : countStats(content).words
  const minutes = readingTimeMinutes(words)

  return (
    <footer className="editor-footer">
      {expanded && (
        <div className="footer-attachments">
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              e.target.value = ''
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Upload
          </button>
          <ul>
            {attachments.length === 0 && <li className="footer-attachments-empty">No attachments</li>}
            {attachments.map((a) => (
              <li key={a.name}>
                <button type="button" className="icon-btn" title="Insert into note" onClick={() => onInsert(a.name)}>
                  <CornerDownLeft size={14} />
                </button>
                <a href={api.attachments.url(notePath, a.name)} target="_blank" rel="noreferrer">
                  {a.name}
                </a>
                <small>{(a.size / 1024).toFixed(1)} KB</small>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="editor-footer-bar">
        <span className="footer-stats">
          {words} words{minutes > 0 && ` · ${minutes} min`}
        </span>
        <button
          type="button"
          className={`footer-attachments-toggle ${expanded ? 'is-open' : ''}`}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <Paperclip size={14} /> {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
        </button>
        <span className="footer-save-state">{saveState}</span>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: NoteView rewiring**

In `web/src/components/NoteView.tsx`:
- Import `{ EditorFooter } from './EditorFooter'`; drop now-unused imports (`Upload`, `CornerDownLeft`) if nothing else uses them.
- Derive save state instead of the transient `status` string for the footer: keep the existing `status` state but pass `saveState={status || (dirty ? 'Unsaved' : 'Saved')}`.
- Remove the `<span className="status">{status}</span>` from the header (the footer shows it now).
- Delete the entire `<section className="attachments-panel">…</section>` block and the `fileRef` input there.
- Render after the editor pane div:
```tsx
<EditorFooter
  notePath={path}
  mode={mode}
  content={content}
  attachments={attachments}
  saveState={status || (dirty ? 'Unsaved' : 'Saved')}
  onInsert={insertAttachment}
  onUpload={(f) => void upload(f)}
/>
```
Keep `upload`, `insertAttachment`, the attachments state, and the `attachment-uploaded` bridge refresh exactly as they are.

- [ ] **Step 3: styles**

Append to `web/src/styles.css` and DELETE the old `.attachments-panel` rules (the section block is gone):
```css
.editor-footer { border-top: 1px solid var(--border); background: var(--surface); }
.editor-footer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.35rem 1rem;
  font-size: 0.8rem;
  color: var(--muted-foreground);
}
.footer-attachments-toggle {
  font-size: 0.8rem;
  padding: 0.25rem 0.6rem;
  background: transparent;
  border-color: transparent;
  color: var(--muted-foreground);
}
.footer-attachments-toggle.is-open, .footer-attachments-toggle:hover { background: var(--surface-2); border-color: var(--border); }
.footer-save-state { min-width: 4rem; text-align: right; }
.footer-attachments { border-bottom: 1px solid var(--border); padding: 0.6rem 1rem; max-height: 160px; overflow-y: auto; }
.footer-attachments ul { list-style: none; margin: 0.5rem 0 0; padding: 0; }
.footer-attachments li { display: flex; align-items: center; gap: 0.5rem; padding: 0.2rem 0; font-size: 0.9rem; }
.footer-attachments li a { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.footer-attachments-empty { color: var(--muted-foreground); }
```

- [ ] **Step 4: verify** — `cd web && bunx tsc --noEmit`; root `bun run web:build`.

- [ ] **Step 5: commit**
```bash
git add web/src/components/EditorFooter.tsx web/src/components/NoteView.tsx web/src/styles.css
git commit -m "feat(web): stats footer with collapsible attachments and save state"
```

---

### Task 5: CommentsRail stub + header toggle (web)

**Files:**
- Create: `web/src/components/CommentsRail.tsx`
- Modify: `web/src/components/NoteView.tsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: CommentsRail**

Create `web/src/components/CommentsRail.tsx`:
```tsx
import { MessageSquare, X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

/** Stubbed comments rail — UI shell only; the comments system has its own upcoming spec. */
export function CommentsRail({ open, onClose }: Props) {
  if (!open) return null
  return (
    <aside className="comments-rail" aria-label="Comments">
      <div className="comments-rail-header">
        <span>Comments</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close comments">
          <X size={16} />
        </button>
      </div>
      <div className="comments-rail-empty">
        <MessageSquare size={28} />
        <p>Comments are coming soon.</p>
        <p className="comments-rail-hint">You'll be able to attach threads to any text selection.</p>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: NoteView toggle**

In `web/src/components/NoteView.tsx`: import `{ CommentsRail } from './CommentsRail'` and `MessageSquare` from lucide-react; add `const [commentsOpen, setCommentsOpen] = useState(false)`. Add to the header actions (next to the mode toggle):
```tsx
<button
  type="button"
  className={`icon-btn ${commentsOpen ? 'is-active' : ''}`}
  title="Comments"
  aria-label="Comments"
  onClick={() => setCommentsOpen((v) => !v)}
>
  <MessageSquare size={16} />
</button>
```
Wrap the editor pane + rail in a flex row so the rail sits beside the editor:
```tsx
<div className="note-body">
  <div className={`editor-pane mode-${mode}`}>…existing children…</div>
  <CommentsRail open={commentsOpen} onClose={() => setCommentsOpen(false)} />
</div>
```

- [ ] **Step 3: styles**

Append to `web/src/styles.css`:
```css
.note-body { display: flex; flex: 1; min-height: 0; }
.note-body .editor-pane { flex: 1; min-width: 0; }
.comments-rail {
  width: 300px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  background: var(--surface);
  display: flex;
  flex-direction: column;
}
.comments-rail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
}
.comments-rail-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--muted-foreground);
  text-align: center;
  padding: 1rem;
}
.comments-rail-hint { font-size: 0.8rem; }
.icon-btn.is-active { background: var(--surface-2); border-color: var(--border); }
@media (max-width: 768px) {
  .comments-rail { position: fixed; right: 0; top: 0; bottom: 0; z-index: 35; box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12); }
}
```
Note: `.editor-pane` currently has `flex: 1` from `.note-view` context — confirm the new `.note-body` wrapper doesn't break the existing `display: grid` on `.editor-pane` (it shouldn't: grid stays inside the flex child).

- [ ] **Step 4: verify** — `cd web && bunx tsc --noEmit`; root `bun run web:build`.

- [ ] **Step 5: commit**
```bash
git add web/src/components/CommentsRail.tsx web/src/components/NoteView.tsx web/src/styles.css
git commit -m "feat(web): toggleable comments rail stub"
```

---

### Task 6: End-to-end verification + bundle refresh

**Files:** throwaway driver in `/tmp/mb-drive/`; commit only `internal/editor/lexical/editor.js` + `editor.css`.

- [ ] **Step 1: serve the build**
```bash
cd /Users/osarogie/mindbase
bun run editor-ui:build && bun run web:build
rm -rf internal/webui/dist && cp -R web/dist internal/webui/dist
go build -o bin/mindbase ./cmd/mindbase
pkill -f "bin/mindbase -vault" || true
nohup ./bin/mindbase -vault ./vault -addr :8780 -ui react > /tmp/mb-drive/shell-server.log 2>&1 &
sleep 2 && curl -s -o /dev/null -w "%{http_code}" http://localhost:8780/
```

- [ ] **Step 2: Playwright pass** (playwright-core lives in /tmp/mb-drive; chromium at `~/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell`). Script `/tmp/mb-drive/shell-e2e.mjs` must:
1. Create a multi-heading note via the API: `PUT /api/notes/outline-test.md` style endpoint — read `web/src/api.ts` notes.save to get the exact method/shape — content `# Alpha\n\nlorem… (40+ short paragraphs to force scrolling)\n\n## Beta\n\nmore\n\n### Gamma\n\nend`.
2. Open `http://localhost:8780/notes/outline-test.md` (1440×900, collect pageerrors).
3. Assert the sidebar shows `.outline-panel` with exactly Alpha/Beta/Gamma items, levels reflected by classes `level-1/2/3`, and a "Library" back button.
4. Click the Gamma outline item; assert the editor scrolled (capture `scrollTop` of the scroll container before/after, expect increase).
5. Assert `.editor-footer-bar` text matches `/\d+ words · \d+ min/` and shows "Saved".
6. Click the attachments toggle; assert the Upload button appears; toggle closed again.
7. Click the comments button (`button[title="Comments"]`); assert `.comments-rail` with "Comments are coming soon."; close it via its X.
8. Select a word in the editor (double-click a paragraph word); assert `.mb-floating-toolbar` appears with the style select, highlight (`==`) and link (🔗) buttons. Click highlight; switch to markdown mode and assert `==word==` appears in `.cm-content`.
9. Click the "Library" back button; assert the library list returned (`.view-tabs` visible).
10. Screenshots: `/tmp/mb-drive/shell-desktop.png` (after step 7, rail open) and a 390×844 run of the note view to `/tmp/mb-drive/shell-mobile.png`.
11. Exit non-zero on any pageerror.
Run until green, debugging properly (no blind sleeps; report app bugs and fix them if they're in the app).

- [ ] **Step 3: full suites**
```bash
cd /Users/osarogie/mindbase/editor-ui && bun run test && bun run typecheck
cd /Users/osarogie/mindbase/web && bunx tsc --noEmit
cd /Users/osarogie/mindbase && go test ./...
```

- [ ] **Step 4: cleanup + commit**
```bash
pkill -f "bin/mindbase -vault" || true
curl -s -X DELETE http://localhost:8780/api/notes/outline-test.md 2>/dev/null || rm -f vault/notes/outline-test.md
rm -rf vault/notes/outline-test.attachments
git add internal/editor/lexical/editor.js internal/editor/lexical/editor.css
git commit -m "build: refresh embedded lexical editor bundle with visual shell"
```
(Delete the test note BEFORE killing the server if using the API; order the commands accordingly.)

---

## Self-review notes (applied)

- Spec coverage: outline (T1+T3), toolbar (T2), footer+attachments (T4), rail (T5), scroll no-op on stale keys (T1 comment), reading-time formula (T1), responsive rail (T5 media query), e2e incl. mobile screenshot (T6). Deferred items (scrollspy, real comments) intentionally absent.
- Type consistency: `OutlineHeading {key,text,level}` identical in T1 (editor-ui) and T3 (web, structurally); `BlockStyle` defined and consumed in T2 only; `readingTimeMinutes` defined T1, consumed T4.
- The footer imports `countStats`/`readingTimeMinutes` from `@mindbase/editor-ui/textStats` — path alias verified (web vite + tsconfig map `@mindbase/editor-ui/*`).
