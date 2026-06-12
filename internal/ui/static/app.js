// mindbase client — Alpine + Toast UI Editor + Notion-style slash commands

function agentLog(location, message, data, hypothesisId) {
  const payload = {
    sessionId: 'c2f09c',
    runId: 'web-editor',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  }
  // #region agent log
  fetch('http://127.0.0.1:7546/ingest/26116013-4ec7-4422-a613-8d6decc169b2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c2f09c' },
    body: JSON.stringify(payload),
  }).catch(() => {})
  fetch('/api/debug/client-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {})
  // #endregion
}

const SLASH_COMMANDS = {
  common: [
    { id: 'h1', label: 'Heading 1', hint: '# at line start', icon: 'H1', keywords: ['heading', 'h1', 'title'], insert: '# ', exec: (ed) => ed.exec('heading', { level: 1 }) },
    { id: 'h2', label: 'Heading 2', hint: '## section', icon: 'H2', keywords: ['heading', 'h2', 'section'], insert: '## ', exec: (ed) => ed.exec('heading', { level: 2 }) },
    { id: 'h3', label: 'Heading 3', hint: '### subsection', icon: 'H3', keywords: ['heading', 'h3'], insert: '### ', exec: (ed) => ed.exec('heading', { level: 3 }) },
    { id: 'bullet', label: 'Bullet list', hint: 'Unordered list', icon: '•', keywords: ['bullet', 'list', 'ul'], insert: '- ', exec: (ed) => ed.exec('bulletList') },
    { id: 'numbered', label: 'Numbered list', hint: 'Ordered list', icon: '1.', keywords: ['numbered', 'ordered', 'ol'], insert: '1. ', exec: (ed) => ed.exec('orderedList') },
    { id: 'todo', label: 'To-do', hint: 'Checkbox task', icon: '☐', keywords: ['todo', 'task', 'checkbox'], insert: '- [ ] ', exec: (ed) => ed.exec('taskList') },
    { id: 'quote', label: 'Quote', hint: 'Blockquote', icon: '❝', keywords: ['quote', 'blockquote'], insert: '> ', exec: (ed) => ed.exec('blockquote') },
    { id: 'code', label: 'Code block', hint: 'Fenced code', icon: '</>', keywords: ['code', 'snippet'], insert: '```\n\n```', exec: (ed) => ed.exec('codeBlock') },
    { id: 'divider', label: 'Divider', hint: 'Horizontal rule', icon: '—', keywords: ['divider', 'hr', 'line'], insert: '---\n', exec: (ed) => ed.exec('hr') },
    { id: 'table', label: 'Table', hint: 'Markdown table', icon: '⊞', keywords: ['table', 'grid'], insert: '| col | col |\n| --- | --- |\n| | |\n', exec: (ed) => ed.exec('table') },
    { id: 'link', label: 'Link', hint: '[text](url)', icon: '↗', keywords: ['link', 'url', 'href'], insert: '[label](https://)\n' },
    { id: 'image', label: 'Image', hint: 'Markdown image', icon: '🖼', keywords: ['image', 'img', 'photo'], insert: '![alt](path/to/image.png)\n' },
    { id: 'callout', label: 'Callout', hint: 'Highlighted note', icon: '💡', keywords: ['callout', 'note', 'tip'], insert: '> **Note:** \n' },
    { id: 'frontmatter', label: 'Frontmatter', hint: 'YAML metadata', icon: 'fm', keywords: ['yaml', 'frontmatter', 'meta'], insert: '---\ntitle: \ntags: []\n---\n\n' },
  ],
  note: [
    { id: 'scheduled', label: 'Scheduled task', hint: '>today #tag', icon: '◷', keywords: ['schedule', 'today'], insert: '- [ ] Task >today #project\n' },
    { id: 'tag', label: 'Tag', hint: '#project', icon: '#', keywords: ['tag'], insert: '#tag ' },
    { id: 'mention', label: 'Mention', hint: '@context', icon: '@', keywords: ['mention', 'context'], insert: '@context ' },
    { id: 'wikilink', label: 'Wiki link', hint: '[[page]]', icon: '🔗', keywords: ['link', 'wiki', 'page'], insert: '[[welcome]]' },
    { id: 'dbembed', label: 'Database embed', hint: '[[db:name]]', icon: '🗃', keywords: ['database', 'db'], insert: '[[db:projects]]' },
    { id: 'mermaid', label: 'Mermaid diagram', hint: 'Flowchart', icon: '◈', keywords: ['mermaid', 'diagram'], insert: '```mermaid\ngraph TD\n  A-->B\n```\n' },
  ],
  database: [
    { id: 'dbrow', label: 'Table row', hint: 'New data row', icon: '+', keywords: ['row'], insert: '| value | value |\n' },
    { id: 'dbheader', label: 'Section heading', hint: 'Inside database md', icon: 'H2', keywords: ['heading'], insert: '## Section\n\n' },
  ],
}

document.addEventListener('alpine:init', () => {
  Alpine.data('markdownDocumentEditor', () => ({
    mode: 'split',
    previewHTML: '',
    editor: null,
    documentKind: '',
    documentPath: '',
    saveStatus: '',
    showSlash: false,
    slashFilter: '',
    slashIndex: 0,
    slashActive: false,
    dirty: false,
    historyOpen: false,
    historyLoading: false,
    historyCommits: [],
    historyPreview: '',
    historyPreviewLabel: '',
    historyPreviewRev: '',

    init() {
      this.documentKind = this.$el.dataset.documentKind || 'note'
      this.documentPath = this.$el.dataset.documentPath || ''
      agentLog('app.js:init', 'markdownDocumentEditor init', {
        kind: this.documentKind,
        path: this.documentPath,
        protocol: location.protocol,
        hasAppShell: !!document.querySelector('.app'),
      }, 'H1')
      this.$watch('mode', (value) => {
        if (value !== 'edit') this.renderPreview()
      })
      this.$nextTick(() => {
        this.initRichEditor(0)
      })
    },

    allSlashCommands() {
      const cmds = [...SLASH_COMMANDS.common]
      if (this.documentKind === 'database') cmds.push(...SLASH_COMMANDS.database)
      else cmds.push(...SLASH_COMMANDS.note)
      return cmds
    },

    filteredSlashCommands() {
      const q = (this.slashFilter || '').trim().toLowerCase()
      if (!q) return this.allSlashCommands()
      return this.allSlashCommands().filter((cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.keywords.some((k) => k.includes(q) || q.includes(k))
      )
    },

    saveUrl() {
      if (this.documentKind === 'database') {
        return `/databases/${this.documentPath}`
      }
      return `/notes/${this.documentPath}`
    },

    gitPath() {
      if (this.documentKind === 'database') {
        const p = this.documentPath.replace(/\.csv$/i, '')
        return `databases/${p}.csv`
      }
      return `notes/${this.documentPath}`
    },

    async toggleHistory() {
      this.historyOpen = !this.historyOpen
      if (this.historyOpen && this.historyCommits.length === 0) {
        await this.loadHistory()
      }
    },

    async loadHistory() {
      this.historyLoading = true
      try {
        const res = await fetch(`/api/history?path=${encodeURIComponent(this.gitPath())}&limit=40`)
        if (!res.ok) throw new Error('history failed')
        const data = await res.json()
        this.historyCommits = data.commits || []
      } catch {
        this.historyCommits = []
      } finally {
        this.historyLoading = false
      }
    },

    formatHistoryDate(iso) {
      try {
        return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      } catch {
        return iso || ''
      }
    },

    async previewHistory(commit) {
      try {
        const res = await fetch(`/api/history/${encodeURIComponent(commit.short)}?path=${encodeURIComponent(this.gitPath())}`)
        if (!res.ok) throw new Error('snapshot failed')
        const data = await res.json()
        this.historyPreview = data.content || ''
        this.historyPreviewRev = commit.short
        this.historyPreviewLabel = `${commit.short} · ${commit.subject}`
      } catch {
        this.historyPreview = ''
        this.historyPreviewLabel = 'Could not load version'
      }
    },

    restoreHistory() {
      if (!this.historyPreview) return
      this.setMarkdown(this.historyPreview)
      this.onEditorInput()
      this.dirty = true
      this.historyOpen = false
      this.saveStatus = 'Restored — save to commit'
    },

    editorMountEl() {
      return this.$refs.editorMount || this.$el.querySelector('.rich-editor-mount')
    },

    editorTextarea() {
      const mount = this.editorMountEl()
      return mount?.querySelector('.editor-markdown-input') || null
    },

    getMarkdown() {
      const ta = this.editorTextarea()
      if (ta) return ta.value
      if (this.editor?.getMarkdown) return this.editor.getMarkdown()
      return this.$el.querySelector('#editor-source')?.value || ''
    },

    setMarkdown(value) {
      const source = this.$el.querySelector('#editor-source')
      if (source) source.value = value
      const ta = this.editorTextarea()
      if (ta) ta.value = value
      if (this.editor?.setMarkdown) this.editor.setMarkdown(value)
    },

    onEditorInput() {
      const source = this.$el.querySelector('#editor-source')
      const ta = this.editorTextarea()
      if (source && ta) source.value = ta.value
      this.scheduleAutosave()
      this.syncSlashFromEditor()
      if (this.mode !== 'edit') this.renderPreviewDebounced()
    },

    insertBlock(text) {
      const ta = this.editorTextarea()
      if (!ta) {
        const cur = this.getMarkdown()
        this.setMarkdown(cur + (cur.endsWith('\n') ? '' : '\n') + text + '\n')
        this.onEditorInput()
        return
      }
      const start = ta.selectionStart ?? ta.value.length
      const end = ta.selectionEnd ?? ta.value.length
      const val = ta.value
      const before = val.slice(0, start)
      const after = val.slice(end)
      const pad = before.length > 0 && !before.endsWith('\n') ? '\n' : ''
      const snippet = `${pad}${text}\n`
      ta.value = before + snippet + after
      const cursor = before.length + snippet.length
      ta.focus()
      ta.setSelectionRange(cursor, cursor)
      this.onEditorInput()
    },

    initRichEditor(attempt = 0) {
      const source = this.$el.querySelector('#editor-source')
      const mount = this.editorMountEl()
      if (!source || !mount) {
        agentLog('app.js:initRichEditor', 'missing mount or source', { attempt }, 'H2')
        if (attempt < 40) {
          setTimeout(() => this.initRichEditor(attempt + 1), 50)
        }
        return
      }

      if (mount.dataset.editorReady === '1' && this.editorTextarea()) {
        return
      }

      mount.innerHTML = ''
      mount.dataset.editorReady = '1'

      const toolbar = document.createElement('div')
      toolbar.className = 'editor-toolbar'
      const quick = [
        ['H1', '# '],
        ['H2', '## '],
        ['List', '- '],
        ['Task', '- [ ] '],
        ['Code', '```\n\n```'],
        ['Link', '[label](url)'],
        ['Wiki', '[[welcome]]'],
        ['DB', '[[db:projects]]'],
      ]
      for (const [label, snippet] of quick) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.textContent = label
        btn.addEventListener('click', () => this.insertBlock(snippet))
        toolbar.appendChild(btn)
      }

      const textarea = document.createElement('textarea')
      textarea.className = 'editor-markdown-input'
      textarea.spellcheck = true
      textarea.value = source.value || ''
      textarea.addEventListener('input', () => this.onEditorInput())
      textarea.addEventListener('keydown', (e) => this.onEditorKeydown(e))
      textarea.addEventListener('keyup', (e) => this.onEditorKeyup(e))

      mount.append(toolbar, textarea)

      agentLog('app.js:initRichEditor', 'markdown editor ready', {
        path: this.documentPath,
        attempt,
        height: mount.getBoundingClientRect().height,
      }, 'H1')

      this.onEditorInput()
    },

    onEditorKeydown(e) {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        this.slashActive = true
        this.slashFilter = ''
        this.slashIndex = 0
        this.showSlash = true
        return
      }
      if (!this.showSlash) return
      if (e.key === 'Escape') {
        e.preventDefault()
        this.closeSlash()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const cmds = this.filteredSlashCommands()
        this.slashIndex = Math.min(this.slashIndex + 1, Math.max(cmds.length - 1, 0))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        this.slashIndex = Math.max(this.slashIndex - 1, 0)
        return
      }
      if (e.key === 'Enter') {
        const cmds = this.filteredSlashCommands()
        if (cmds.length > 0) {
          e.preventDefault()
          this.runSlashCommand(cmds[this.slashIndex] || cmds[0])
        }
      }
    },

    onEditorKeyup(e) {
      if (!this.slashActive && !this.showSlash) return
      if (e.key === 'Backspace') {
        this.syncSlashFromEditor()
        if (!this.slashFilter && !this.getSlashQueryFromMarkdown()) {
          this.closeSlash()
        }
        return
      }
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        this.syncSlashFromEditor()
      }
    },

    syncSlashFromEditor() {
      const q = this.getSlashQueryFromMarkdown()
      if (q !== null) {
        this.slashActive = true
        this.showSlash = true
        this.slashFilter = q
        const cmds = this.filteredSlashCommands()
        if (this.slashIndex >= cmds.length) this.slashIndex = 0
      } else if (this.slashActive) {
        this.closeSlash()
      }
    },

    getSlashQueryFromMarkdown() {
      const md = this.getMarkdown()
      const lines = md.split('\n')
      for (let i = lines.length - 1; i >= 0; i--) {
        const m = lines[i].match(/\/([\w-]*)$/)
        if (m) return m[1]
      }
      return null
    },

    removeSlashToken() {
      const lines = this.getMarkdown().split('\n')
      for (let i = lines.length - 1; i >= 0; i--) {
        if (/\/[\w-]*$/.test(lines[i])) {
          lines[i] = lines[i].replace(/\/[\w-]*$/, '')
          this.setMarkdown(lines.join('\n'))
          this.onEditorInput()
          return
        }
      }
    },

    runSlashCommand(cmd) {
      if (!cmd) return
      this.removeSlashToken()
      this.insertBlock(cmd.insert)
      this.closeSlash()
    },

    closeSlash() {
      this.showSlash = false
      this.slashActive = false
      this.slashFilter = ''
      this.slashIndex = 0
    },

    scheduleAutosave() {
      this.dirty = true
      clearTimeout(this._autosaveTimer)
      this.saveStatus = 'Unsaved'
      this._autosaveTimer = setTimeout(() => this.save(false), 800)
    },

    renderPreviewDebounced() {
      clearTimeout(this._previewTimer)
      this._previewTimer = setTimeout(() => this.renderPreview(), 350)
    },

    currentMarkdown() {
      return this.getMarkdown()
    },

    async renderPreview() {
      if (!this.documentPath) return
      const content = this.currentMarkdown()
      if (this.documentKind === 'database') {
        this.previewHTML = `<div class="markdown-preview-inner"><pre>${escapeHtml(content)}</pre></div>`
        return
      }
      try {
        const res = await fetch('/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, path: this.documentPath }),
        })
        if (!res.ok) throw new Error(await res.text())
        const html = await res.text()
        this.previewHTML = unwrapPreviewHTML(html)
        agentLog('app.js:renderPreview', 'preview updated', {
          path: this.documentPath,
          contentLength: content.length,
          htmlLength: this.previewHTML.length,
        }, 'H3')
        this.$nextTick(() => {
          this.enhancePreview()
          const root = this.$refs.previewMount
          if (root && typeof htmx !== 'undefined') {
            htmx.process(root)
          }
          agentLog('app.js:renderPreview', 'preview dom mounted', {
            path: this.documentPath,
            childCount: root?.childElementCount || 0,
            visible: root ? root.offsetParent !== null : false,
            mode: this.mode,
          }, 'H6')
        })
      } catch (err) {
        this.previewHTML = `<p class="muted">Preview failed: ${escapeHtml(String(err.message || err))}</p>`
        agentLog('app.js:renderPreview', 'preview failed', {
          path: this.documentPath,
          error: String(err.message || err),
        }, 'H3')
      }
    },

    enhancePreview() {
      const root = this.$refs.previewMount || this.$el
      if (typeof mermaid !== 'undefined' && !window.__mindbaseMermaidInit) {
        mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true, theme: 'dark' })
        window.__mindbaseMermaidInit = true
      }
      root.querySelectorAll('.mermaid-block pre.mermaid').forEach(async (el) => {
        if (el.dataset.rendered) return
        el.dataset.rendered = '1'
        const source = (el.textContent || '').trim()
        if (!source || typeof mermaid === 'undefined') return
        try {
          const { svg } = await mermaid.render('m-' + Math.random().toString(36).slice(2), source)
          el.parentElement.innerHTML = svg
        } catch (e) {
          el.parentElement.innerHTML = `<pre class="mermaid-error">${escapeHtml(String(e.message || e))}</pre>`
        }
      })
      root.querySelectorAll('.excalidraw-file-link').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.preventDefault()
          loadExcalidrawFile(this.documentPath, el.dataset.file)
        })
      })
    },

    async save(manual = false) {
      const content = this.currentMarkdown()
      this.saveStatus = 'Saving…'
      const res = await fetch(this.saveUrl(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'HX-Request': 'true' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        this.dirty = false
        this.saveStatus = 'Saved'
        setTimeout(() => { if (!this.dirty) this.saveStatus = '' }, 1500)
        if (this.documentKind === 'note') await this.renderPreview()
      } else {
        this.saveStatus = 'Save failed'
      }
    },
  }))

  Alpine.data('vaultItemList', () => ({
    menu: { open: false, x: 0, y: 0, row: null },

    openMenu(event, row) {
      this.menu = { open: true, x: event.clientX, y: event.clientY, row }
    },

    menuStyle() {
      return `left:${this.menu.x}px;top:${this.menu.y}px`
    },

    async revealItem(row) {
      if (!row?.dataset) return
      const kind = row.dataset.kind
      const path = row.dataset.path
      try {
        const res = await fetch('/reveal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, path }),
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || res.statusText)
        }
      } catch (e) {
        alert(String(e.message || e))
      }
    },
  }))

  Alpine.data('connectorsPanel', () => ({
    loading: false,
    message: '',
    syncSource: 'notion',
    syncSink: 'gdrive',
    creds: {},
    forms: {
      notion_token: '',
      anthropic_api_key: '',
      gdrive_credentials_json: '',
      google_oauth_client_json: '',
      notion_oauth_client_id: '',
      notion_oauth_client_secret: '',
    },

    async init() {
      await Promise.all([this.loadCredentials(), this.loadConfig()])
    },

    async loadConfig() {
      try {
        const cfg = await fetch('/api/connectors/config').then((r) => r.json())
        this.syncSource = cfg.source || 'notion'
        this.syncSink = cfg.sink || 'gdrive'
      } catch (_) {
        this.syncSource = 'notion'
        this.syncSink = 'gdrive'
      }
    },

    topologySummary() {
      const names = { notion: 'Notion', gdrive: 'Google Drive' }
      const src = names[this.syncSource] || this.syncSource
      const sink = names[this.syncSink] || this.syncSink
      return `${src} → vault → ${sink}`
    },

    async saveSyncTopology() {
      if (this.syncSource === this.syncSink) {
        this.message = 'Source and sink must be different connectors'
        return
      }
      if (this.syncSink === 'notion') {
        this.message = 'Notion as sink is not supported yet — choose Google Drive'
        this.syncSink = 'gdrive'
        return
      }
      this.loading = true
      this.message = 'Saving sync topology…'
      try {
        const cfg = await fetch('/api/connectors/config').then((r) => r.json())
        cfg.source = this.syncSource
        cfg.sink = this.syncSink
        const res = await fetch('/api/connectors/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cfg),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || res.statusText)
        this.syncSource = data.source || this.syncSource
        this.syncSink = data.sink || this.syncSink
        this.message = `Sync topology saved: ${this.topologySummary()}`
      } catch (e) {
        this.message = String(e.message || e)
      } finally {
        this.loading = false
      }
    },

    async loadCredentials() {
      try {
        this.creds = await fetch('/api/connectors/credentials').then((r) => r.json())
      } catch (_) {
        this.creds = {}
      }
    },

    async saveCredentials(kind) {
      this.loading = true
      this.message = 'Saving credentials…'
      try {
        const body = {}
        if (kind === 'notion' && this.forms.notion_token) body.notion_token = this.forms.notion_token
        if (kind === 'anthropic' && this.forms.anthropic_api_key) body.anthropic_api_key = this.forms.anthropic_api_key
        const res = await fetch('/api/connectors/credentials', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || res.statusText)
        this.creds = data
        this.forms.notion_token = ''
        this.forms.anthropic_api_key = ''
        this.message = 'Credentials saved locally'
      } catch (e) {
        this.message = String(e.message || e)
      } finally {
        this.loading = false
      }
    },

    async saveGoogleOAuthClient() {
      if (!this.forms.google_oauth_client_json) return
      this.loading = true
      try {
        const res = await fetch('/api/connectors/credentials', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ google_oauth_client_json: this.forms.google_oauth_client_json }),
        })
        this.creds = await res.json()
        this.message = 'Google OAuth client saved — you can now Sign in with Google'
      } catch (e) {
        this.message = String(e.message || e)
      } finally {
        this.loading = false
      }
    },

    async saveGDriveServiceAccount() {
      if (!this.forms.gdrive_credentials_json) return
      this.loading = true
      try {
        const res = await fetch('/api/connectors/credentials', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gdrive_credentials_json: this.forms.gdrive_credentials_json }),
        })
        this.creds = await res.json()
        this.message = 'Google service account saved'
      } catch (e) {
        this.message = String(e.message || e)
      } finally {
        this.loading = false
      }
    },

    async saveNotionOAuthApp() {
      this.loading = true
      try {
        const res = await fetch('/api/connectors/credentials', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notion_oauth_client_id: this.forms.notion_oauth_client_id,
            notion_oauth_client_secret: this.forms.notion_oauth_client_secret,
          }),
        })
        this.creds = await res.json()
        this.message = 'Notion OAuth app saved'
      } catch (e) {
        this.message = String(e.message || e)
      } finally {
        this.loading = false
      }
    },

    oauthRedirect(path) {
      return `${window.location.origin}${path}`
    },

    async startGDriveOAuth() {
      const redirectUri = this.oauthRedirect('/api/connectors/gdrive/oauth/callback')
      const res = await fetch(`/api/connectors/gdrive/oauth/start?redirect_uri=${encodeURIComponent(redirectUri)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      window.open(data.auth_url, '_blank', 'width=520,height=720')
      this.message = 'Complete Google sign-in in the popup window'
    },

    async startNotionOAuth() {
      const redirectUri = this.oauthRedirect('/api/connectors/notion/oauth/callback')
      const res = await fetch(`/api/connectors/notion/oauth/start?redirect_uri=${encodeURIComponent(redirectUri)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      window.open(data.auth_url, '_blank', 'width=520,height=720')
      this.message = 'Complete Notion sign-in in the popup window'
    },

    async syncAll() {
      this.loading = true
      this.message = `Syncing ${this.topologySummary()}…`
      try {
        const res = await fetch('/api/connectors/sync', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || res.statusText)
        const parts = []
        if (data.notion) {
          parts.push(`Notion: ${(data.notion.imported || 0) + (data.notion.updated || 0)} updated, ${data.notion.cached || 0} cached`)
        }
        if (data.gdrive) {
          parts.push(`Drive: ↑${(data.gdrive.uploaded || 0) + (data.gdrive.updated || 0)} ↓${data.gdrive.downloaded || 0}`)
        }
        this.message = parts.join(' · ') || 'Sync complete'
        setTimeout(() => location.reload(), 1500)
      } catch (e) {
        this.message = String(e.message || e)
      } finally {
        this.loading = false
      }
    },

    async importNotion() {
      this.loading = true
      this.message = 'Importing from Notion…'
      try {
        await this.ensureEnabled('notion')
        const res = await fetch('/api/connectors/notion/import', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || res.statusText)
        this.message = `Imported ${data.imported} pages${data.errors?.length ? ` (${data.errors.length} errors)` : ''}`
        setTimeout(() => location.reload(), 1200)
      } catch (e) {
        this.message = String(e.message || e)
      } finally {
        this.loading = false
      }
    },

    async syncGDrive() {
      this.loading = true
      this.message = 'Syncing to Google Drive…'
      try {
        await this.ensureEnabled('gdrive')
        const res = await fetch('/api/connectors/gdrive/sync', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || res.statusText)
        this.message = `Uploaded ${data.uploaded}, updated ${data.updated}, downloaded ${data.downloaded || 0} files`
      } catch (e) {
        this.message = String(e.message || e)
      } finally {
        this.loading = false
      }
    },

    async ensureEnabled(kind) {
      const cfg = await fetch('/api/connectors/config').then((r) => r.json())
      cfg.source = cfg.source || 'notion'
      cfg.sink = cfg.sink || 'gdrive'
      if (kind === 'notion' && cfg.source !== 'notion') {
        cfg.source = 'notion'
        if (cfg.sink === 'notion') cfg.sink = 'gdrive'
      }
      if (kind === 'gdrive' && cfg.sink !== 'gdrive' && cfg.source !== 'gdrive') {
        cfg.sink = 'gdrive'
      }
      await fetch('/api/connectors/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    },
  }))

  Alpine.data('aiAssistant', () => ({
    open: false,
    input: '',
    loading: false,
    messages: [],
    meta: '',

    init() {
      document.addEventListener('open-ai', () => { this.open = true })
    },

    notePath() {
      return document.querySelector('[data-document-path]')?.dataset?.documentPath || ''
    },

    async send() {
      const text = this.input.trim()
      if (!text || this.loading) return
      this.messages.push({ role: 'user', text })
      this.input = ''
      this.loading = true
      try {
        const res = await fetch('/api/connectors/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, note_path: this.notePath(), use_vault: true }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || res.statusText)
        this.messages.push({ role: 'assistant', text: data.reply })
        const parts = []
        if (data.headroom_used) parts.push('Headroom ✓')
        if (data.rtk_used) parts.push('RTK ✓')
        if (data.tokens_saved) parts.push(`${data.tokens_saved} tokens saved`)
        this.meta = parts.join(' · ')
      } catch (e) {
        this.messages.push({ role: 'assistant', text: `Error: ${e.message}` })
      } finally {
        this.loading = false
      }
    },
  }))
})

window.loadExcalidrawFile = async (notePath, file) => {
  const res = await fetch(`/excalidraw/${notePath}/${file}`)
  const data = await res.json()
  const preview = document.getElementById('preview')
  if (!preview) return
  const box = document.createElement('div')
  box.className = 'excalidraw-embed'
  box.innerHTML = `<pre>${JSON.stringify(data, null, 2).slice(0, 1200)}…</pre>`
  preview.prepend(box)
}

window.mindbaseSync = {
  async changes(since) {
    const url = since ? `/api/sync/changes?since=${encodeURIComponent(since)}` : '/api/sync/changes'
    return fetch(url).then((r) => r.json())
  },
  async pull(paths) {
    return fetch('/api/sync/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    }).then((r) => r.json())
  },
  async push(files) {
    return fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    }).then((r) => r.json())
  },
}

function unwrapPreviewHTML(html) {
  const trimmed = String(html || '').trim()
  const prefix = '<div class="markdown-preview-inner">'
  const suffix = '</div>'
  if (trimmed.startsWith(prefix) && trimmed.endsWith(suffix)) {
    return trimmed.slice(prefix.length, trimmed.length - suffix.length)
  }
  return trimmed
}

function reinitMainEditor(mainEl) {
  if (!mainEl || mainEl.id !== 'main') return
  if (typeof Alpine !== 'undefined' && Alpine.initTree) {
    Alpine.initTree(mainEl)
  }
  requestAnimationFrame(() => {
    const docEl = mainEl.querySelector('[data-document-kind]')
    if (!docEl) {
      agentLog('app.js:htmx:afterSettle', 'main swapped (no editor page)', {}, 'H2')
      return
    }
    const state = docEl._x_dataStack?.[0]
    const mount = state?.editorMountEl?.()
    const ready = mount?.dataset.editorReady === '1' && state?.editorTextarea?.()
    if (ready) {
      state.renderPreview?.()
      agentLog('app.js:htmx:afterSettle', 'main swapped (editor kept)', {
        path: state?.documentPath || '',
        hasTextarea: true,
      }, 'H2')
      return
    }
    if (mount) delete mount.dataset.editorReady
    if (state?.initRichEditor) {
      state.initRichEditor(0)
      state.renderPreview?.()
    }
    agentLog('app.js:htmx:afterSettle', 'main swapped', {
      path: state?.documentPath || '',
      hasEditor: Boolean(state?.initRichEditor),
      hasTextarea: Boolean(state?.editorTextarea?.()),
    }, 'H2')
  })
}

document.body.addEventListener('htmx:afterSettle', (e) => {
  if (e.detail.target?.id !== 'main') return
  reinitMainEditor(e.detail.target)
})

window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return
  const main = document.getElementById('main')
  if (main) reinitMainEditor(main)
})

document.addEventListener('DOMContentLoaded', () => {
  // #region agent log
  const cs = getComputedStyle(document.documentElement)
  agentLog('app.js:boot', 'theme tokens applied', {
    bg: cs.getPropertyValue('--bg').trim(),
    accent: cs.getPropertyValue('--accent').trim(),
    editorBg: cs.getPropertyValue('--editor-bg').trim(),
    hasPageSheet: Boolean(document.querySelector('.page-sheet')),
  }, 'design')
  // #endregion
  if (location.protocol === 'file:') {
    agentLog('app.js:boot', 'file protocol — use make dev URL', { href: location.href }, 'H5')
    const warn = document.createElement('div')
    warn.className = 'file-protocol-warning'
    warn.innerHTML = '<strong>mindbase must run through the local server.</strong> Use <code>make dev</code> then open <a href="http://localhost:8090">http://localhost:8090</a> — not a saved HTML file.'
    document.body.prepend(warn)
  }
})

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

;(function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${location.host}/api/ws`)
  ws.onmessage = () => {
    const badge = document.getElementById('sync-status')
    if (badge) htmx.trigger(badge, 'load')
  }
  ws.onclose = () => setTimeout(connectWS, 3000)
})()
