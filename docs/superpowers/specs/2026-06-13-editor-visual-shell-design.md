# Editor Visual Shell — Design

**Date:** 2026-06-13
**Status:** Approved (design dialogue with visual companion, 2026-06-13)
**Scope:** Web. The full comments system is explicitly out of scope (separate spec); this iteration ships its UI shell only.

## Goal

Bring the note editor up to the document-workspace design the user provided: a document outline in the sidebar while editing, a richer floating selection toolbar, a slim status footer with word count and reading time, and a toggleable right rail that will later host comments.

## Decisions (from design dialogue)

- **Outline placement:** the left sidebar switches modes — library by default, document outline while a note is open, with a "← Library" back row. No second column.
- **Footer:** a slim status bar absorbs the always-open attachments panel: stats left, a `📎 N attachments` expander in the middle (panel functionality unchanged, shown as a collapsible sheet), save state right.
- **Right rail:** toggleable via a 💬 header button, hidden by default, ~300px, overlay below 768px. Contents this iteration: stubbed empty state ("Comments are coming soon").
- **Toolbar additions:** link, text-style dropdown (paragraph/H1/H2/H3/quote), and `==highlight==`. No underline (markdown has no native form; portability wins).

## Architecture (approach A — editor emits structure, web owns chrome)

`editor-ui` (shared, host-agnostic):
- **OutlinePlugin** — on the existing 280ms change debounce, posts `{ type: 'outline', headings: [{ key, text, level }] }` bridge messages (H1–H3, document order, `key` = Lexical node key). Exposes `window.mindbaseScrollToHeading(key)` (same global pattern as `mindbaseInsertAttachment`) which scrolls the heading's DOM element into view.
- **FloatingToolbarPlugin** — extended with: link button (registered `LinkNode` + `TOGGLE_LINK_COMMAND`, small inline URL input within the toolbar popover), text-style dropdown applying `$setBlocksType` (paragraph, h1, h2, h3, quote), and a highlight button toggling Lexical's native `highlight` text format. `@lexical/markdown`'s standard transformers already round-trip `==highlight==`.
- **bridge.ts** — new `outline` message type and the `mindbaseScrollToHeading` window declaration.

`web` (all chrome, no server changes):
- **OutlinePanel** (`web/src/components/OutlinePanel.tsx`) — rendered by `Sidebar` when the route is a note: "← Library" back row (navigates to `/`), note title, indented heading list (click → `mindbaseScrollToHeading`). Empty state: muted "No headings yet".
- **EditorFooter** (`web/src/components/EditorFooter.tsx`) — left: `N words · M min` where minutes = `max(1, ceil(words / 225))` when words > 0; stats from `stats` bridge events in rich mode, computed from `content` via the same formula in markdown/preview modes. Middle: `📎 N attachments` toggle expanding the existing attachments panel content (upload/insert/delete behavior unchanged) as a collapsible sheet above the footer. Right: save state — `Saved` / `Unsaved` / `Saving…` (replaces the current header status text).
- **CommentsRail** (`web/src/components/CommentsRail.tsx`) — toggled by a 💬 header button in `NoteView`; fixed ~300px column right of the editor pane, overlay below 768px; stub empty state this iteration.
- **Sidebar** — gains outline mode (route-driven); library rendering unchanged on non-note routes.
- **NoteView** — composes the footer and rail, drops the old always-open `attachments-panel` section and the header `status` span.

## Out of scope / deferred

- Scrollspy (highlighting the current section in the outline) — future enhancement.
- Real comments: storage, anchoring, threads, resolve — separate spec; the rail ships with an empty-state stub only.
- Mobile/macOS shells: they receive `outline` bridge events for free but build no UI this iteration.

## Error handling

- Outline clicks on stale keys (heading deleted between debounce ticks): `mindbaseScrollToHeading` no-ops when the node key no longer resolves.
- Notes with no headings: outline shows its empty state; sidebar back row always works.
- Stats before the first bridge event: footer renders `0 words` until the editor reports.

## Testing

- **vitest (editor-ui):** outline extraction (levels, order, text, key stability), highlight markdown round-trip (`==x==` byte-stable), toolbar block-style application via headless editor.
- **vitest-able pure web logic:** reading-time math (225 wpm, ceil, min 1).
- **Playwright screenshot pass:** outline sidebar on a multi-heading note, footer with attachments expander open/closed, rail toggled, at 1440px and 390px widths; click an outline entry and assert the heading scrolled into view.
