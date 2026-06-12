# mindbase

Local-first notes and data manager — **Go core** + **templ/htmx web** + **native SwiftUI macOS**.

## Storage

| Type | Location |
|------|----------|
| Notes | `vault/notes/*.md` |
| Databases | `vault/databases/*.csv` |
| Attachments | `vault/notes/{note}.attachments/` |

## macOS (libmindbase embedded)

The macOS app embeds **libmindbase** (Go compiled as a C shared library) for all vault content operations — notes, databases, search, markdown preview, and git-tracked saves.

```bash
make desktop   # builds libmindbase.dylib + mindbase.app
open macos/build/mindbase.app
```

Default vault: `~/mindbase-vault` (change in **Settings → Vault**).

For **Notion / Google / Claude OAuth**, configure an **Auth API URL** in **Settings → Connectors** pointing at your hosted mindbase web server. OAuth uses that remote API only.

```
SwiftUI ──C API──► libmindbase.dylib (Go: notes, DBs, search, preview, git)
        ──auth──► hosted mindbase API (OAuth, connector sync)
```

## Mobile (Expo + libmindbase)

The local Expo module `mobile/modules/mindbase` wraps the same C API for iOS and Android. Use a **development build** (`expo-dev-client`) — Expo Go cannot load custom native code.

```bash
make libmindbase       # macOS dylib + iOS/Android libs when SDKs available
make mobile-prebuild   # build native libs + expo prebuild
pnpm mobile:ios        # or pnpm mobile:android
pnpm mobile:start      # Metro for dev client
```

Vault path on device defaults to the app documents directory (`…/mindbase-vault`). Content is managed entirely by **libmindbase** — no local HTTP server.

```
React Native ──Expo module──► libmindbase (Go: notes, DBs, search, preview, git)
```

## Web server (content + UI)

The Go server powers the **web client** only. Run it when you want the browser UI or remote auth endpoints:

```bash
make build && make run
# → http://localhost:8080
```

Connector sync is **on-demand** (`POST /api/connectors/sync`) — no background daemon.

## Package manager (pnpm)

This repo uses **pnpm workspaces** for mobile and legacy web:

```bash
pnpm install          # or: make pnpm-install
pnpm web:dev          # legacy React UI
pnpm mobile:prebuild  # Expo prebuild (after libmindbase)
pnpm mobile:start     # Metro dev client
```

## Features

- Wiki links `[[note|label]]`, database embeds `[[db:name]]`, cross-page CSV links
- Full-text search (`/api/search`)
- Mermaid + Excalidraw (web templ UI; macOS preview via WKWebView + Mermaid CDN)
- Sync API (`/api/sync/changes`, `/pull`, `/push`)
- **Notion-like UX** — page titles, breadcrumbs, `/` slash commands, floating AI panel
- **Notion source** — direct API sync into `vault/notes/notion/` with incremental cache
- **Google Drive** — bidirectional sync (push local changes, pull remote updates)
- **Local cache** — `vault/.mindbase/cache/index.json` tracks Notion page IDs and Drive file mappings
- **Claude AI** — vault-aware assistant with **Headroom** token compression + **RTK** context compression

## Connectors setup

Configure via the **Connect** panel in the UI, macOS **Settings → Connectors**, env vars, or an env file:

```bash
# Option A: UI — paste tokens in Connectors panel (stored in vault/.mindbase/secrets.json)

# Option B: shell env vars
export NOTION_TOKEN=secret_...
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Option C: env file (works when launching mindbase.app from Finder)
mkdir -p ~/.mindbase
cp vault/.mindbase/env.example ~/.mindbase/env
```

**SSO:** Save a Google OAuth client JSON in the UI, then click **Sign in with Google**. For Notion OAuth, save client ID/secret then **Sign in with Notion**. Register redirect URIs in each provider console:
- `http://127.0.0.1:8080/api/connectors/gdrive/oauth/callback`
- `http://127.0.0.1:8080/api/connectors/notion/oauth/callback`
(use your actual mindbase port if different)

# Optional: Headroom proxy for 60–90% token savings on AI calls
pip install "headroom-ai[proxy]"
headroom proxy --port 8787

# Optional: RTK for compressing vault context before Claude
brew install rtk
```

Open **Connect** in the sidebar or visit `/connectors`. Use the **✦** button for Claude chat on any page.

**How sync works**

1. The app loads notes from the local vault immediately (offline-first).
2. When credentials are set, the Go core connects directly to Notion and Google Drive APIs.
3. Changed Notion pages are pulled into `notes/notion/`; only pages edited since last sync are re-fetched.
4. Google Drive sync is bidirectional — local edits upload, remote changes download into the vault cache.
5. Auto-sync runs every 15 minutes (configurable in `connectors.json`). macOS triggers sync when the embedded Go core starts.

API endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/connectors/sync` | Sync Notion + Drive + refresh cache |
| `GET /api/connectors/cache` | Cache stats (page/file counts, last sync times) |
| `POST /api/connectors/notion/import` | Notion-only sync |
| `POST /api/connectors/gdrive/sync` | Drive-only sync |

Connector config is stored at `vault/.mindbase/connectors.json` (env var names only, no secrets).

## Development

```bash
make tools            # verify pinned Go tools (air, templ)
make dev              # hot reload with air → http://localhost:8090
make run              # production binary → http://localhost:8080
make cli              # agent CLI → bin/mind
make install-cli      # install mind to ~/.local/bin
```

### Agent CLI (`mind` / `mindbase`)

Git-style history and vault queries for agents. Build with `make cli` or use subcommands on the server binary:

```bash
export MINDBASE_VAULT=./vault   # optional, default ./vault

mind log --oneline -n 10        # commit history
mind show HEAD                  # patch for a commit
mind status                     # working tree
mind diff                       # unstaged changes
mind snapshot --json            # vault inventory for agents
mind search "welcome" --json
mind note list
mind note get welcome.md

# Same commands on the server binary:
./bin/mindbase log --oneline
```

Install `mind` globally: `make install-cli`. Optional shell alias: `alias mindbase=mind`.

Use `--json` on any command for structured agent output.

Go tools are pinned in `go.mod`:

```go
tool (
    github.com/a-h/templ/cmd/templ
    github.com/air-verse/air
)
```

Run directly: `go tool air`, `go tool templ generate ./internal/ui/templates/...`

## Mobile (Expo)

```bash
make libmindbase
make mobile-prebuild
pnpm mobile:ios       # or pnpm mobile:android
```

MIT License
