# mindbase

Local-first notes and data manager — **Go core** (`libmindbase`) with **templ/htmx web**, **SwiftUI macOS**, and **Expo mobile**.

Every save is git-tracked in the vault. Notes are plain markdown; databases are CSV; attachments stay on disk.

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

The default UI is **templ + htmx + Alpine** (no Node build required for the main app).

- **Paper light** design — warm paper palette, Literata serif for reading, centered page column
- **Sepia dark** — follows `prefers-color-scheme: dark`
- **Edit / Split / Preview** modes, `/` slash commands, format toolbar
- **History** panel — browse and restore prior git versions per note
- **✦ AI** floating panel — vault-aware Claude assistant
- Mermaid diagrams, Excalidraw embeds, wiki links, database embeds

Design reference: [`docs/UI-DESIGN-BRIEF.md`](docs/UI-DESIGN-BRIEF.md)

```bash
make dev      # :8090 — air hot reload (go, templ, js, css)
make run      # :8780 — embedded static assets
```

Legacy React UI (optional): `bun web:dev` then `make run -web web/dist`.

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
make tools            # verify pinned Go tools (air, templ)
make dev              # hot reload → http://localhost:8090
make run              # production binary → http://localhost:8780
make build            # compile bin/mindbase (runs templ generate)
make cli              # bin/mind agent CLI
make install-cli      # install mind to ~/.local/bin
make templ            # regenerate internal/ui/templates/*_templ.go
make desktop          # macOS app + libmindbase.dylib
make libmindbase      # build C shared library for native targets
```

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

Bun workspaces cover mobile and the legacy React web UI:

```bash
bun install
bun web:dev
bun mobile:prebuild
bun mobile:start
```

## License

MIT
