# mindbase — UI Design Brief (All Platforms)

**Version:** 1.0 · **Date:** June 2025  
**Audience:** Product & UI/UX designers  
**Repo:** [mindbase](https://github.com/osarogie/mindbase) (local-first notes + databases vault)

---

## 1. Executive summary

**mindbase** is a local-first knowledge workspace: markdown notes, CSV databases, wiki-style linking, journal/tasks, and optional cloud connectors (Notion, Google Drive) plus a vault-aware AI assistant (Claude). Data lives on disk in a **vault** folder; every save is git-tracked.

The product ships on **four surfaces** that share one Go core (`libmindbase`) but differ in chrome and feature depth:

| Platform | Stack | Primary role |
|----------|-------|--------------|
| **Web (primary)** | Go server + templ/htmx + Alpine.js | Full-featured browser UI, OAuth host, connectors |
| **macOS** | SwiftUI + embedded `libmindbase.dylib` | Native desktop, offline vault, settings |
| **iOS / Android** | Expo (React Native) + native module | Mobile capture & edit on the go |
| **Legacy web** | React + Vite (`web/`) | Older SPA; being superseded by templ UI |

**Design north star:** Notion-like clarity (page titles, breadcrumbs, slash commands) with Obsidian-style local ownership — calm, fast, trustworthy, never “SaaS trapped.”

---

## 2. Product principles (for design decisions)

1. **Local-first** — Content is always available offline; sync is explicit and visible, never silent data loss.
2. **Files you own** — Notes are `.md`, databases are `.csv`; the UI reflects real paths and folders.
3. **One vault, many views** — Sidebar library, journal, tasks, tags, and search are different lenses on the same data.
4. **Progressive disclosure** — Power features (connectors, OAuth, AI compression) stay in dedicated areas; writing stays clean.
5. **Cross-platform parity** — Every feature and spec must be available on web, macOS, and mobile. Shared logic belongs in Go; UI adapts to each platform without dropping capability.
6. **Agent-friendly** — Structured history (`mind log`) and predictable IA help humans and AI agents navigate the vault.

---

## 3. Users & primary jobs

| Persona | Jobs to be done |
|---------|-----------------|
| **Knowledge worker** | Daily journal, project notes, task capture, full-text search |
| **Researcher / writer** | Long-form markdown, backlinks, tags, preview while editing |
| **Ops / data-minded user** | CSV “databases” in notes, row-linked pages, spreadsheet-style edits |
| **Integrator** | Pull Notion/Drive into vault, sync on demand, keep local cache |
| **Power user + agents** | Git history, CLI snapshot/search, AI panel grounded in vault context |

---

## 4. Information architecture

```
mindbase
├── Library (default)
│   ├── Folder tree (notes/*.md, databases/*.csv)
│   ├── Item list (title, subtitle, icon by kind)
│   └── Search (live, full-text)
├── Calendar / Journal
│   ├── Today, yesterday, rolling week
│   └── Daily note navigation (← → between days)
├── Tasks
│   ├── Open tasks inbox (aggregated - [ ] from all notes)
│   └── Per-note task list in meta panel
├── Tags
│   └── Filter library by #tag
├── Note / Database page
│   ├── Breadcrumb · title · edit/split/preview
│   ├── Meta: tags, backlinks, tasks
│   ├── Editor + preview
│   └── Attachments / Excalidraw (web)
├── Connectors (web + macOS settings)
│   ├── Notion · Google Drive · Claude status
│   ├── Sync actions + cache stats
│   └── Credentials / OAuth
└── AI assistant (floating panel, web)
    └── Claude chat with vault context
```

**Global chrome:** persistent **sidebar** (collapsible on narrow viewports) + **main content** + optional **FAB** (mobile menu, AI on web).

---

## 5. Platform parity matrix

Use this to scope design work and set expectations with engineering.

| Feature | Web (templ) | macOS | Mobile | Notes for design |
|---------|:-----------:|:-----:|:------:|------------------|
| Sidebar + library tree | ✅ | ✅ | ✅ (flat list) | Mobile: no folder tree yet |
| Search | ✅ | ✅ | ✅ | Snippet results on desktop |
| Note editor | ✅ Rich (Toast UI) | ✅ WebView editor | ✅ Plain markdown + toolbar | Unify editor affordances |
| Edit / Split / Preview | ✅ | Partial | Write / Preview toggle | Mobile: single column |
| Page title + breadcrumb | ✅ | ✅ | Path + title field | Align hierarchy |
| Slash `/` commands | ✅ | — | — | Design command palette pattern |
| Wiki links `[[note\|label]]` | ✅ | ✅ preview | Preview links | Missing-link style |
| Database CSV editor | ✅ | ✅ | — | Table UX, row hover → page |
| DB embed `[[db:name]]` | ✅ | ✅ | — | Inline table in preview |
| Mermaid diagrams | ✅ | ✅ (CDN) | — | Block container styling |
| Excalidraw embeds | ✅ | Limited | — | Canvas + file list |
| Attachments upload | ✅ | — | — | Panel under editor |
| Journal / calendar nav | ✅ | ✅ | Today only | Extend mobile calendar |
| Tasks inbox | ✅ | ✅ | — | Badge count in sidebar |
| Tags | ✅ | ✅ | — | Chip pattern |
| Backlinks panel | ✅ | — | — | Meta block on note |
| Connectors UI | ✅ | ✅ Settings | — | Card grid + cred forms |
| Claude AI panel | ✅ | — | — | FAB + slide-up panel |
| Git save status | ✅ | ✅ | Dirty dot + status | Consistent copy |
| Dark / light theme | Dark only | System | Light (Notion-like) | **Needs unified tokens** |
| OAuth / SSO buttons | ✅ | Via Auth API URL | — | Provider button styles |

---

## 6. Core screens (design each with states)

### 6.1 App shell — Sidebar + main

**Layout:** Horizontal split; sidebar **300px** (web) / **280px** (legacy) / flexible (mobile drawer).

**Sidebar sections (top → bottom):**
1. Brand row — logo + “mindbase” + vault name
2. **Calendar** — Today, recent days, “This week”
3. **Open tasks** — label + numeric badge
4. **Tags** — horizontal chips (when tags exist)
5. **Search** — full-width field, debounced results list (max ~160px height)
6. **View tabs** — Library | Connect
7. **Folder tree** — section labels (uppercase, muted), nested items

**Item row anatomy:**
- Icon (note vs database)
- Title (ellipsis)
- Subtitle / modified hint (muted, small)
- Context menu (⋯) — open, rename, delete, reveal in Finder (macOS)

**States:** default, hover, active/selected, empty library, loading skeleton, search-no-results.

**Mobile (<768px):** Sidebar off-canvas; hamburger FAB bottom-left; backdrop dimmer.

---

### 6.2 Home / empty state

When nothing is selected:

- **Web:** Notion-style home — gradient cover band, welcome copy, 3–4 feature cards (Journal, Tasks, Connectors, Claude)
- **macOS:** Centered SF Symbol + “Select a note or database, or ⌘N”
- **Mobile:** Empty list CTA in sidebar; editor empty state when applicable

---

### 6.3 Note / database page

**Header bar:**
- Breadcrumb: `Library / Page title` (+ “· database” for CSV-backed pages)
- Actions: **✦ AI** (notes only) · **Edit | Split | Preview** · save status · **Save**

**Title area:**
- Large page title (H1, ~2rem, tight tracking)
- Journal day nav links (← previous day | next day →) when applicable

**Meta panel** (notes only, below title):
- Tags (pill chips)
- Backlinks (title + context snippet)
- Tasks in this note (checkbox, done strikethrough, schedule badge)

**Editor area:**
- **Edit:** Rich markdown (web) or plain textarea (mobile) with formatting toolbar
- **Split:** Editor | Preview side-by-side (min-width ~820px for mobile tablet layout)
- **Preview:** Rendered markdown — headings, code, tables, wiki links, embeds

**Footer panels (web):**
- Attachments — upload + file list
- Excalidraw file buttons

**Save status copy:** `Saving…` · `Unsaved` · `Saved` · `Up to date` (align across platforms)

---

### 6.4 Slash command menu (web reference)

Triggered by `/` in editor.

- Floating menu anchored near caret
- Sections: “Commands” header (uppercase label)
- Rows: icon badge + label + hint subtitle
- Keyboard: ↑↓ navigate, Enter run, Esc close
- Empty filter state: “No matching commands”

*Designer deliverable:* full command list with icons (heading, list, task, code, mermaid, database embed, etc.)

---

### 6.5 Tasks inbox

- List of open tasks aggregated vault-wide
- Row: checkbox glyph · task text · source note link · schedule badge
- Empty: short hint linking to journal/task syntax (`- [ ]`)

---

### 6.6 Connectors

**Header:** title, subtitle (“Direct Notion + Google Drive · cached locally”), primary **Sync all now**

**Cache stats strip:** page/file counts, auto-sync interval

**Three cards (responsive grid):**
1. **Notion** — connected badge, last sync, Sync button
2. **Google Drive** — bidirectional copy, folder id, Sync button
3. **Claude AI** — model, Headroom/RTK status, Open assistant CTA

**Credentials section:** three cred cards (Notion token/OAuth, Google OAuth/service account, Anthropic key). Password fields, secondary OAuth buttons, collapsible “advanced” `<details>` blocks.

**Status badges:** `Connected` (green) vs `Not configured` (yellow) — pill, uppercase, small.

---

### 6.7 AI assistant panel (web)

- **Closed:** circular FAB bottom-right, gradient purple, “✦” glyph, shadow
- **Open:** ~420px wide panel, max 60vh, above FAB
- Header: “Claude · Headroom · RTK” + close
- Message list: user bubbles (right, tinted accent) vs assistant (left, surface)
- Footer: text input + Send; optional meta line (token/compression stats)

---

### 6.8 macOS Settings (separate window)

Tabbed modal ~520×560:
- **Vault** — path field + Apply
- **Connectors** — embedded connector settings (mirrors web cred patterns)

---

### 6.9 Mobile-specific

**Two modes:**
- **Phone:** list screen → push editor screen (back chevron)
- **Tablet (≥820px):** split view — sidebar | editor (like desktop)

**Sidebar FAB:** floating “+” for new page when `showFab`

**Note editor card:**
- Inline title field
- Toolbar chips: H1, H2, list, task, code, link
- Write / Preview segmented control
- Auto-save (~1.8s debounce) — no manual Save required on mobile

**Haptics:** light impact on save, selection on toolbar tap (design should not rely on haptics for critical feedback)

---

## 7. Design system — current tokens & gaps

### 7.1 Web / legacy web (dark theme)

Primary reference: `internal/ui/static/app.css`

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#0f0f14` | App background |
| `--surface` | `#1a1a24` | Sidebar, panels |
| `--surface-2` | `#242433` | Inputs, hover rows |
| `--border` | `#2e2e42` | Dividers, outlines |
| `--text` | `#e8e8f0` | Body |
| `--muted` | `#9898b0` | Secondary text |
| `--accent` | `#7c6af7` | Primary actions, brand |
| `--accent-hover` | `#9585ff` | Links, hover |
| `--danger` | `#e85555` | Destructive |
| `--radius` | `10px` | Cards, inputs |

**Typography:** SF Pro Text / system UI stack  
**Buttons:** 8px radius, 1px border; `.primary` filled accent  
**Icons:** Emoji in places (✦, ☰); favicon is custom SVG (notebook + graph nodes)

### 7.2 Mobile (light / Notion-inspired)

Reference: `mobile/src/theme.ts`

| Token | Value |
|-------|-------|
| `bg` | `#FBFBFA` |
| `surface` | `#FFFFFF` |
| `text` | `#37352F` |
| `accent` | `#2383E2` (blue, not purple) |

**Gap for designer:** Choose either (a) unified brand with light/dark modes on all platforms, or (b) intentional “mobile = light, desktop web = dark” with mapped semantic tokens.

### 7.3 Recommended semantic token set (deliverable)

Provide Figma variables for:

```
color.background.primary
color.background.secondary
color.background.elevated
color.border.default / strong
color.text.primary / secondary / muted
color.accent.primary / hover / soft
color.status.success / warning / danger
radius.sm / md / lg / pill
space.xs → xl
font.size.caption → display
shadow.fab / shadow.panel / shadow.menu
```

---

## 8. Component inventory

| Component | Variants | Platforms |
|-----------|----------|-----------|
| App shell | desktop split, mobile drawer | all |
| Sidebar header | with/without close (mobile) | all |
| Search field | with results dropdown | all |
| Nav link row | default, active, with badge | all |
| Folder section label | uppercase section header | web, macOS |
| Item row | note, database, search result | all |
| View tabs | Library, Connect | web |
| Tag chip | default, active | web, macOS |
| Breadcrumb | 2+ levels | web, macOS, mobile (simplified) |
| Mode toggle | Edit / Split / Preview | web; Write / Preview mobile |
| Primary / secondary / icon button | disabled, loading | all |
| Save status indicator | dot + text | all |
| Markdown preview | prose styles, code blocks, tables | all |
| Wiki link | exists vs missing (dashed muted) | web |
| Slash menu | filtered list | web |
| Task row | open, done, scheduled | web, macOS |
| Connector card | connected/disconnected | web, macOS |
| Status badge | ok / warn | web |
| Credential form card | OAuth expanders | web, macOS |
| AI FAB + panel | open/closed | web |
| Empty state | illustration + CTA | all |
| Toast / inline error | alert banner | all |
| Database table | editable cells, row preview | web |
| Attachment list | upload zone | web |

---

## 9. Content model (affects UI)

### Notes (`vault/notes/**/*.md`)
- First `# heading` or filename → display title
- `#tags` in body → tag index
- `- [ ]` / `- [x]` → tasks
- `[[note]]` / `[[note|label]]` → wiki links
- `[[db:name]]` → embedded database table
- `@mention` styling in preview
- Schedule syntax → badge on tasks

### Databases (`vault/databases/*.csv`)
- Spreadsheet columns + rows
- Row can link to a note page (preview panel below table on web)

### Attachments
- Stored under `vault/notes/{note}.attachments/`

### Journal
- Daily notes keyed by ISO date
- Calendar sidebar jumps to dated pages

---

## 10. Interaction & motion

| Interaction | Guidance |
|-------------|----------|
| Sidebar open (mobile) | 200ms slide + backdrop fade |
| Search | 200ms debounce; results replace inline |
| Auto-save | Debounced; status text transition, no blocking modal |
| Pull-to-refresh | Mobile list only |
| Unsaved back navigation | Confirm dialog if dirty (mobile) |
| HTMX navigation (web) | Partial page swap — design for no full flash |
| AI panel | Fade/slide up; FAB remains visible when closed |

Keep motion subtle; respect `prefers-reduced-motion`.

---

## 11. Responsive breakpoints

| Breakpoint | Behavior |
|------------|----------|
| **<768px** | Web: off-canvas sidebar, single-column editor, preview hidden in split |
| **≥768px** | Web: persistent sidebar |
| **≥820px** | Mobile: two-column master-detail |

Design **320px → 1440px** for web; **iPhone SE → iPad Pro** for mobile; macOS **min window ~900×600**.

---

## 12. Accessibility

- WCAG 2.1 AA contrast for text and interactive elements (validate both dark and light tokens)
- Full keyboard path: sidebar search, list navigation, editor, slash menu, AI panel
- Visible focus rings on all platforms (especially dark theme)
- Touch targets ≥44×44pt on mobile
- Screen reader labels for icon-only buttons (New page, Today, Refresh, AI)
- Do not convey state by color alone (save status uses text + dot)

---

## 13. Brand & iconography

**Existing mark:** Notebook page + connected nodes, purple gradient on dark rounded square (`internal/ui/static/icons/favicon.svg`).

**Wordmark:** “mindbase” — lowercase, accent-colored on web sidebar.

**AI glyph:** ✦ (four-point star) — used for Claude entry points.

**Designer deliverables:**
- App icon set (macOS, iOS, Android adaptive, favicon, PWA)
- Optional wordmark + cover gradient for home screen
- Icon mapping table (note, database, journal, task, connector, sync, search)
- Light + dark logo variants

---

## 14. Copy & tone

- **Voice:** Clear, calm, technical but friendly — not playful corporate.
- **Prefer:** “Sync now”, “Up to date”, “Open tasks”, “Local cache”
- **Avoid:** “Unlock”, “Upgrade”, cloud-first language that implies lock-in
- **Errors:** Plain language + actionable next step (“Check vault path”, “Could not save note”)

---

## 15. Out of scope / v2 (label in designs, don’t block v1)

- Real-time multi-user collaboration
- Custom themes per vault
- Mobile connectors & OAuth
- Mobile database editor
- Full Excalidraw editor on mobile/native
- Slash commands on mobile/native (markdown toolbar only for now)
- Windows/Linux desktop apps

---

## 16. Design deliverables checklist

Hand off to engineering in this order:

1. **Figma library** — colors (semantic), type scale, spacing, radius, elevation
2. **App shell** — desktop + mobile + macOS window chrome
3. **Sidebar** — all sections, states, empty/loading
4. **Note page** — edit/split/preview, meta panel, attachments
5. **Slash command menu** — items, keyboard focus states
6. **Tasks inbox** + task row in note
7. **Connectors** — cards, badges, credential forms, OAuth buttons
8. **AI panel** — FAB, chat layout, loading/streaming state *(optional wireframe)*
9. **Database editor** — table, row preview, embed in note preview
10. **Component specs** — buttons, inputs, chips, tabs, modals, toasts
11. **Icon set** + app icons export (@1x–@3x, icns, svg)
12. **Redlines** — spacing, min tap targets, breakpoint behavior notes
13. **Theme decision doc** — unified vs split light/dark strategy

**Formats:** Figma (preferred), PDF flow export, SVG assets, optional Lottie for sync indicator.

---

## 17. Engineering reference map

| Area | Path in repo |
|------|----------------|
| Web templates & IA | `internal/ui/templates/layout.templ` |
| Web styles (canonical dark) | `internal/ui/static/app.css` |
| Web JS (editor, slash, AI) | `internal/ui/static/app.js` |
| Legacy React web | `web/src/` |
| Mobile app | `mobile/src/components/` |
| Mobile theme tokens | `mobile/src/theme.ts` |
| macOS SwiftUI | `macos/Mindbase/*.swift` |
| Favicon / logo SVG | `internal/ui/static/icons/favicon.svg` |
| Product features list | `README.md` |

---

## 18. Open questions for design review

1. **Single theme or dual?** Mobile is light/Notion-blue; web is dark/purple — unify brand accent and support system dark/light everywhere?
2. **Editor paradigm** — Rich WYSIWYG (web) vs markdown-first (mobile): converge on hybrid “Notion block” or keep markdown source of truth with formatted preview?
3. **Navigation on mobile** — Add calendar/tasks/tags parity or keep minimal list-first UX?
4. **AI placement on desktop** — Persistent panel vs FAB-only vs inline “Ask AI” in note header?
5. **Database UX on small screens** — Read-only embed preview vs dedicated mobile table editor?

---

*Questions or walkthrough with engineering: open an issue or refer to `README.md` for build/run instructions per platform.*
