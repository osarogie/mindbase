# Embed Attachments in the Editor — Design

**Date:** 2026-06-12
**Status:** Approved (design dialogue 2026-06-12)
**Scope:** Web-first. Mobile/macOS shells get embed rendering via the shared editor; their native upload flows are a later iteration.

## Goal

Attachments become first-class content in the rich editor: images render inline, non-image files render as compact file cards, and users can insert attachments by paste, drag-drop, slash command, or from the attachments panel. Markdown stays standard and portable.

## Background

- Attachments are stored per note in a sibling folder `<note>.attachments/` (`vault.AttachmentDir`), uploaded via `POST /api/attachments/<note>`, listed via `GET /api/attachments/<note>`, served via `GET /api/files/<note>/<file>`. The server sanitizes filenames and falls back to a uuid when sanitization empties one — the server-returned name is authoritative.
- The Lexical editor lives in the shared `editor-ui` workspace package, consumed three ways: imported directly by `web`, and loaded in WebViews by the Expo mobile app and macOS shell via a message bridge (`window.mindbaseSetMarkdown`, `mindbase-editor` CustomEvents). It is host-agnostic and currently has no image or attachment support — the `/image` slash command inserts literal markdown text.
- `web`'s `MarkdownPreview` already rewrites relative image sources to `/api/files/<note>/<src>`.

## Architecture: host adapter (chosen approach)

All embed functionality lives in `editor-ui`, but I/O is delegated through a small adapter so the editor stays host-agnostic:

```ts
interface AttachmentHost {
  upload(file: File): Promise<{ path: string }>      // returns markdown-relative path (server name authoritative)
  resolveUrl(path: string): string                    // markdown path → viewable URL
  list(): Promise<{ name: string; path: string }[]>  // for the slash-command picker
}
```

- `EditorApp` accepts an optional `attachmentHost` prop (used by web) and falls back to `window.mindbaseAttachmentHost` (bridge-registered, for future WebView shells).
- No adapter present → paste/upload/picker are disabled gracefully; rendering still works. Default `resolveUrl` is the identity function, so absolute `http(s)` images always render.
- Web's `LexicalEditor` implements the adapter with the existing endpoints; no new server endpoints. `NoteView` passes the note `path` down and refreshes its attachments panel on an `attachment-uploaded` bridge event.

Rejected alternatives: forking the editor for web (registers nodes outside the shared composer — divergence); writing absolute `/api/files/...` URLs into markdown (breaks vault portability).

## Nodes and markdown convention

Two `DecoratorNode`s in `editor-ui`:

- **`ImageNode { src, alt }`** — renders the resolved `<img>` (lazy-loaded, max-width 100%, Paper-theme rounded corners), selectable and deletable. Load failure renders a broken-image placeholder card showing the path.
- **`FileCardNode { src, label }`** — compact card (paperclip icon, filename); click opens the resolved URL in a new tab.

Markdown transformers (added to `MINDBASE_TRANSFORMERS`):

- `![alt](src)` → `ImageNode` when the path extension is png/jpg/jpeg/gif/webp/svg/avif (query strings stripped before testing), otherwise `FileCardNode`.
- Export is the identical `![alt](src)` — lossless round-trip.
- Remote `http(s)` sources are rendered untouched.

**Path convention:** new embeds write the sibling-relative path `note.attachments/photo.png` — portable to GitHub/Obsidian/any markdown viewer. Readers accept both this and the legacy bare `photo.png` form. `resolveUrl` (web) and `MarkdownPreview` strip the `*.attachments/` prefix when building `/api/files/...` URLs (small `MarkdownPreview` update included in scope).

## Insertion flows

1. **Paste / drag-drop** — an `AttachmentPlugin` in `editor-ui` handles Lexical's `DRAG_DROP_PASTE` (covers both gestures). Per file: insert a temporary "uploading…" placeholder at the cursor → `host.upload()` → replace the placeholder with `ImageNode`/`FileCardNode` using the server-returned name. On failure: remove the placeholder and emit an error via the bridge status event.
2. **Slash commands** — new `/attachment` plus `/image` re-pointed from literal-text insertion. Both open a popover picker: the note's existing attachments (`host.list()`) plus an "Upload file…" item backed by a hidden file input.
3. **Attachments panel** — each row in `NoteView`'s panel gets an Insert button calling a new bridge function `window.mindbaseInsertAttachment(path)`, which inserts the appropriate node at the current selection. In markdown mode the button inserts `![](path)` at the CodeMirror cursor instead.

## Error handling and edge cases

- Upload failure → placeholder removed, status message emitted; no orphaned markdown.
- Filename collisions/sanitization → always use the server-returned name.
- Files pasted with no host adapter → ignored gracefully.
- Deleting an attachment still referenced in a note → broken-image placeholder on next render; no reference scanning in this iteration.
- Large files: no client-side limit imposed in this iteration (server behavior unchanged).

## Testing

- **Unit (new vitest + `@lexical/headless` setup in `editor-ui`):** transformer round-trips (markdown → nodes → markdown), image vs file-card detection, both path forms, `AttachmentPlugin` insert/replace logic against a fake host.
- **Go:** existing attachment API tests already cover the server; no server changes expected.
- **End-to-end:** Playwright screenshot driver — drop a file into the editor, verify the rendered embed and the saved markdown.

## Related follow-on projects (separate specs)

- Go engine → WebAssembly for the web UI (client-side vault/markdown logic, parallel to libmindbase on mobile/macOS).
- Migrate web chrome from legacy `styles.css` components to shadcn/ui (one design system; theme unification landed 2026-06-12).
