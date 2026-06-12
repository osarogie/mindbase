# mindbase

Local-first notes and data manager — **Go core** (`libmindbase`) with **React web**, **SwiftUI macOS**, and **Expo mobile**.

Every save is git-tracked in the vault. Notes are plain markdown; databases are CSV; attachments stay on disk.

**Cross-platform by default:** every feature and spec must ship on **web, macOS, and mobile** (unless explicitly marked experimental). Shared behavior lives in Go (`libmindbase`, vault format, connectors, AI, version history); each surface implements the same product contract with native UX.

## Cross-platform contract

| Layer | Shared across platforms |
|-------|-------------------------|
| **Data** | Vault layout, markdown notes, CSV databases, git history, `.mindbase` config |
| **Core API** | `libmindbase` — open vault, read/write notes & DBs, search, WYSIWYG page, HTML↔MD, snapshots, AI chat |
| **Product features** | Library, journal, tasks/tags, multi-tab editor, version history, slash/format tools, connectors, AI assistant |
| **Formats** | Markdown, CSV, wiki links, embeds, attachments, frontmatter |

When adding or changing a feature, define it once for all platforms, implement the Go/API path first, then land web + macOS + mobile in the same change (or split PRs that clearly track parity). Platform-specific chrome is fine; **capability gaps are not**.

## Quick start

```bash
make dev                  # hot reload → http://localhost:8090
# open a note, edit, save — commits land in vault/.git

make build && make run    # production binary → http://localhost:8780
make cli                  # agent CLI → bin/mind
```

Default vault for development: `./vault`. Override with `-vault` or `MINDBASE_VAULT`.

## Storage

| Type | Location |
|------|----------|
| Notes | `vault/notes/**/*.md` |
| Databases | `vault/databases/**/*.csv` |
| Attachments | `vault/notes/{note}.attachments/` |
| Git history | `vault/.git` (auto-init on first save) |
| Connector config | `vault/.mindbase/connectors.json` |
| Secrets | `vault/.mindbase/secrets.json` (gitignored) |

## Web UI

The default UI is **React** (Vite + Tailwind + shadcn/ui), embedded in the Go binary after `make react-ui`. Use `-ui templ` for the legacy **templ + htmx + Alpine** UI (no Node build).

| Mode | Command |
|------|---------|
| React (default after build) | `make run` or `make run-react` |
| React dev (HMR) | `bun web:dev` + server with `-web web/dist -ui react` |
| templ fallback | `make run-templ` or `-ui templ` |

React features: sidebar navigation, note/database views, Lexical editor, shadcn components. Add UI with `cd web && bunx shadcn@latest add <name>`.

The templ UI includes Tailwind utilities via `internal/ui/static/tw.css` (`make ui-css`).

```bash
make dev         # :8090 — air hot reload (templ UI)
make run         # :8780 — React if built, else templ
make run-react   # build + embed React, then run
make run-templ   # force templ UI
```

## Version history

Saves call `git add` + `git commit` automatically. Browse history in the web UI (**History** button on any note) or via CLI/API:

```bash
mind log --oneline -n 20 notes/welcome.md
mind show HEAD
mind diff notes/welcome.md
```

| Endpoint | Purpose |
|----------|---------|
| `GET /api/history?path=notes/welcome.md&limit=30` | Commits touching a file |
| `GET /api/history/{rev}?path=notes/welcome.md` | File snapshot at revision |

## macOS (libmindbase embedded)

The macOS app embeds **libmindbase** (Go as a C shared library) for vault operations — notes, databases, search, markdown preview, and git-tracked saves.

```bash
make desktop
open macos/build/mindbase.app
```

Default vault: `~/mindbase-vault` (change in **Settings → Vault**).

For **Notion / Google / Claude OAuth**, set an **Auth API URL** in **Settings → Connectors** pointing at your hosted mindbase web server.

```
SwiftUI ──C API──► libmindbase.dylib (notes, DBs, search, preview, git)
        ──auth──► hosted mindbase API (OAuth, connector sync)
```

## Mobile (Expo dev client + libmindbase)

Pure **Expo CNG** workflow — `expo prebuild` generates `ios/` and `android/`, and **expo-dev-client** loads your JS from Metro. This is not a brownfield embed; the app is React Native from the root with a local Expo module for native code.

The local module `mobile/modules/mindbase` wraps the same C API for iOS and Android. **Expo Go cannot load custom native code** — you need a development build.

```bash
make libmindbase          # build libmindbase + iOS XCFramework / Android .so
make mobile-prebuild      # libmindbase + expo prebuild (generates ios/ android/)
bun mobile:ios           # compile & install dev client on simulator/device
bun mobile:start         # Metro — connect from the dev client launcher
```

**Rebuild the dev client** after native changes (module, plugins, prebuild config):

```bash
cd mobile && bun prebuild:clean && bun ios
```

Optional **EAS dev client** (TestFlight / APK distribution):

```bash
cd mobile && eas build --profile development --platform ios
```

Vault on device: app documents directory (`…/mindbase-vault`). No local HTTP server.

## Features

- Wiki links `[[note|label]]`, database embeds `[[db:name]]`, cross-page CSV links
- Tags `#tag`, tasks `- [ ]`, scheduled tasks `>today`, mentions `@context`
- Journal pages (`/journal/today`, weekly views)
- Full-text search (`/api/search`, sidebar search)
- Mermaid + Excalidraw (web; macOS preview via WKWebView)
- Sync API (`/api/sync/changes`, `/pull`, `/push`)
- **Notion** — import into `vault/notes/notion/` with incremental cache
- **Google Drive** — bidirectional sync
- **Claude AI** — Headroom token compression + RTK context compression (optional)

### Slash commands (web editor)

Type `/` in the editor: headings, lists, tasks, quotes, code, tables, dividers, links, images, callouts, frontmatter, wiki links, database embeds, mermaid.

## Connectors

Configure via **Connect** in the sidebar, macOS **Settings → Connectors**, env vars, or `~/.mindbase/env`:

```bash
# UI — paste tokens in Connectors panel → vault/.mindbase/secrets.json

# Shell
export NOTION_TOKEN=secret_...
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Env file (Finder launches)
mkdir -p ~/.mindbase
cp vault/.mindbase/env.example ~/.mindbase/env
```

**OAuth redirect URIs** (adjust port if needed):

- `http://127.0.0.1:8780/api/connectors/gdrive/oauth/callback`
- `http://127.0.0.1:8780/api/connectors/notion/oauth/callback`

**Optional AI compression:**

```bash
pip install "headroom-ai[proxy]" && headroom proxy --port 8787
brew install rtk
```

**Sync flow:** local vault loads immediately (offline-first). When credentials are set, Notion pages pull into `notes/notion/` and Drive syncs bidirectionally. Auto-sync defaults to every 15 minutes (`connectors.json`).

| Endpoint | Purpose |
|----------|---------|
| `POST /api/connectors/sync` | Sync Notion + Drive + refresh cache |
| `GET /api/connectors/cache` | Cache stats |
| `POST /api/connectors/notion/import` | Notion-only |
| `POST /api/connectors/gdrive/sync` | Drive-only |

## Development

```bash
make tools            # verify pinned Go tools (air, templ, task)
go tool task --list   # same workflows via Taskfile (https://taskfile.dev)
make dev              # hot reload → http://localhost:8090
make run              # production binary → http://localhost:8780
make build            # compile bin/mindbase (runs templ generate)
make cli              # bin/mind agent CLI
make install-cli      # install mind to ~/.local/bin
make templ            # regenerate internal/ui/templates/*_templ.go
make desktop          # macOS app + libmindbase.dylib
make libmindbase      # build C shared library for native targets
```

[Task](https://taskfile.dev) is pinned in `go.mod`; use `go tool task build`, `go tool task dev`, etc. (`Taskfile.yml` mirrors the Makefile).

### Server flags

```bash
./bin/mindbase -vault ./vault -addr :8780
./bin/mindbase -tls-cert cert.pem -tls-key key.pem   # HTTPS + HTTP/3 (QUIC)
./bin/mindbase log --oneline                         # CLI subcommands on same binary
```

Go tools are pinned in `go.mod`:

```go
tool (
    github.com/a-h/templ/cmd/templ
    github.com/air-verse/air
    github.com/go-task/task/v3/cmd/task
)
```

### Agent CLI (`mind` / `mindbase`)

Git-style vault queries for agents and scripts:

```bash
export MINDBASE_VAULT=./vault

mind log --oneline -n 10 notes/welcome.md
mind show HEAD
mind status
mind diff
mind snapshot --json
mind search "welcome" --json
mind note list
mind note get welcome.md
```

Install globally: `make install-cli`. Use `--json` on any command for structured output.

## Package manager (Bun)

Bun workspaces cover mobile and the React web UI:

```bash
bun install
bun web:dev
bun mobile:prebuild
bun mobile:start
```

## License

MIT
