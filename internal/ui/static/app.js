// mindbase client — Alpine + Toast UI Editor + Notion-style slash commands

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

    init() {
      this.documentKind = this.$el.dataset.documentKind || 'note'
      this.documentPath = this.$el.dataset.documentPath || ''
      this.initRichEditor()
      this.renderPreview()
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

    insertBlock(text) {
      if (!this.editor) return
      if (this.editor.isWysiwygMode?.() && this.editor.getCurrentModeEditor) {
        const ww = this.editor.getCurrentModeEditor()
        ww?.replaceSelection?.(text)
      } else {
        const cur = this.editor.getMarkdown()
        this.editor.setMarkdown(cur + (cur.endsWith('\n') ? '' : '\n') + text + '\n')
      }
      this.scheduleAutosave()
    },

    initRichEditor() {
      const source = this.$el.querySelector('#editor-source')
      const mount = this.$el.querySelector('#rich-editor')
      if (!source || !mount || typeof toastui === 'undefined' || !toastui.Editor) return

      if (this.editor?.destroy) {
        this.editor.destroy()
      }

      this.editor = new toastui.Editor({
        el: mount,
        height: '100%',
        initialEditType: 'wysiwyg',
        previewStyle: 'vertical',
        hideModeSwitch: false,
        usageStatistics: false,
        initialValue: source.value || '',
        toolbarItems: [
          ['heading', 'bold', 'italic', 'strike'],
          ['hr', 'quote'],
          ['ul', 'ol', 'task'],
          ['table', 'link'],
          ['code', 'codeblock'],
        ],
      })

      this.editor.on('change', () => {
        this.scheduleAutosave()
        this.syncSlashFromEditor()
        if (this.mode !== 'edit') this.renderPreviewDebounced()
      })

      mount.addEventListener('keydown', (e) => this.onEditorKeydown(e), true)
      mount.addEventListener('keyup', (e) => this.onEditorKeyup(e), true)
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
      if (!this.editor) return null
      const md = this.editor.getMarkdown()
      const lines = md.split('\n')
      for (let i = lines.length - 1; i >= 0; i--) {
        const m = lines[i].match(/\/([\w-]*)$/)
        if (m) return m[1]
      }
      return null
    },

    removeSlashToken() {
      if (!this.editor) return
      const lines = this.editor.getMarkdown().split('\n')
      for (let i = lines.length - 1; i >= 0; i--) {
        if (/\/[\w-]*$/.test(lines[i])) {
          lines[i] = lines[i].replace(/\/[\w-]*$/, '')
          this.editor.setMarkdown(lines.join('\n'))
          return
        }
      }
    },

    runSlashCommand(cmd) {
      if (!cmd || !this.editor) return
      this.removeSlashToken()
      if (this.editor.isWysiwygMode?.() && cmd.exec) {
        try {
          cmd.exec(this.editor)
        } catch (_) {
          this.insertBlock(cmd.insert)
        }
      } else {
        this.insertBlock(cmd.insert)
      }
      // #region agent log
      fetch('http://127.0.0.1:7546/ingest/19aeefbe-e543-4029-bbca-6ccc85f380f3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2f09c'},body:JSON.stringify({sessionId:'c2f09c',location:'app.js:runSlashCommand',message:'slash command',data:{id:cmd.id,kind:this.documentKind},timestamp:Date.now(),hypothesisId:'H8'})}).catch(()=>{});
      // #endregion
      this.closeSlash()
      this.scheduleAutosave()
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

    async renderPreview() {
      if (!this.documentPath) return
      if (this.documentKind === 'database') {
        const content = this.editor ? this.editor.getMarkdown() : this.$el.querySelector('#editor-source')?.value || ''
        this.previewHTML = `<div class="markdown-preview-inner"><pre>${escapeHtml(content)}</pre></div>`
        return
      }
      const res = await fetch(`/preview/${this.documentPath}`)
      const html = await res.text()
      this.previewHTML = html.replace(/^<div class="markdown-preview-inner">|<\/div>$/g, '')
      this.$nextTick(() => this.enhancePreview())
    },

    enhancePreview() {
      document.querySelectorAll('.mermaid-block pre.mermaid').forEach(async (el) => {
        if (el.dataset.rendered) return
        el.dataset.rendered = '1'
        if (typeof mermaid !== 'undefined') {
          try {
            const { svg } = await mermaid.render('m-' + Math.random().toString(36).slice(2), el.textContent)
            el.parentElement.innerHTML = svg
          } catch (e) {
            el.textContent = String(e)
          }
        }
      })
      document.querySelectorAll('.excalidraw-file-link').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.preventDefault()
          loadExcalidrawFile(this.documentPath, el.dataset.file)
        })
      })
    },

    async save(manual = false) {
      const content = this.editor ? this.editor.getMarkdown() : this.$el.querySelector('#editor-source')?.value
      this.saveStatus = 'Saving…'
      // #region agent log
      fetch('http://127.0.0.1:7546/ingest/19aeefbe-e543-4029-bbca-6ccc85f380f3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2f09c'},body:JSON.stringify({sessionId:'c2f09c',location:'app.js:save',message:'document save',data:{kind:this.documentKind,path:this.documentPath,manual,bytes:(content||'').length},timestamp:Date.now(),hypothesisId:'H7'})}).catch(()=>{});
      // #endregion
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
      await this.loadCredentials()
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
      this.message = 'Syncing Notion + Google Drive to local cache…'
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
      if (kind === 'notion' && !cfg.notion?.enabled) {
        cfg.notion.enabled = true
        await fetch('/api/connectors/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
      }
      if (kind === 'gdrive' && !cfg.gdrive?.enabled) {
        cfg.gdrive.enabled = true
        await fetch('/api/connectors/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
      }
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

document.body.addEventListener('htmx:afterSwap', (e) => {
  if (e.detail.target?.id === 'main') {
    const docEl = e.detail.target.querySelector('[data-document-kind]')
    if (docEl?._x_dataStack?.[0]?.initRichEditor) {
      docEl._x_dataStack[0].initRichEditor()
      docEl._x_dataStack[0].renderPreview?.()
    }
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
