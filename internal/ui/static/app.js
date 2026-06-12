// mindbase client — Alpine + Go WYSIWYG editor
// Slash commands mirror editor-ui/src/slashCommands.ts (Lexical iframe handles / in rich mode).

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
  function getEditorTabs() {
    return document.getElementById('editor-workspace')?._x_dataStack?.[0] ?? null
  }

  Alpine.data('attachmentsPanel', (notePath) => ({
    notePath,
    dragging: false,
    uploading: false,
    status: '',
    statusKind: '',

    async onPick(e) {
      const files = e.target.files
      if (files?.length) await this.uploadFiles(files)
      e.target.value = ''
    },

    async onDrop(e) {
      this.dragging = false
      const files = e.dataTransfer?.files
      if (files?.length) await this.uploadFiles(files)
    },

    async uploadFiles(fileList) {
      this.uploading = true
      this.status = ''
      this.statusKind = ''
      try {
        for (const file of fileList) {
          const fd = new FormData()
          fd.append('file', file)
          const res = await fetch(`/attachments/${this.notePath}`, {
            method: 'POST',
            body: fd,
            headers: { 'HX-Request': 'true' },
          })
          if (!res.ok) throw new Error((await res.text()) || `Upload failed for ${file.name}`)
          if (this.$refs.list) this.$refs.list.innerHTML = await res.text()
        }
        this.status = `Uploaded ${fileList.length} file${fileList.length === 1 ? '' : 's'}`
        this.statusKind = 'ok'
        this.updateCount()
      } catch (err) {
        this.status = String(err.message || err)
        this.statusKind = 'err'
      } finally {
        this.uploading = false
        setTimeout(() => {
          this.status = ''
        }, 2800)
      }
    },

    updateCount() {
      const n = this.$refs.list?.querySelectorAll('.attachment-row')?.length ?? 0
      let badge = this.$el.querySelector('.attachments-count')
      if (n === 0) {
        badge?.remove()
        return
      }
      if (!badge) {
        badge = document.createElement('span')
        badge.className = 'attachments-count'
        this.$el.querySelector('.attachments-panel-header h3')?.appendChild(badge)
      }
      badge.textContent = String(n)
    },
  }))

  Alpine.data('appShell', () => ({
    sidebarOpen: false,
    sidebarCollapsed: localStorage.getItem('mindbase-sidebar-collapsed') === '1',
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
      localStorage.setItem('mindbase-sidebar-collapsed', this.sidebarCollapsed ? '1' : '0')
      this.sidebarOpen = false
    },
  }))

  Alpine.data('markdownDocumentEditor', () => ({
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
    _wysiwygFrame: null,
    _pendingHtml: null,
    _mdSyncTimer: null,
    _autosaveTimer: null,
    _onWysiwygMessage: null,

    init() {
      this.documentKind = this.$el.dataset.documentKind || 'note'
      this.documentPath = this.$el.dataset.documentPath || ''
      this.$nextTick(() => this.initEditor(0))
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
      if (this.documentKind === 'note') {
        this.reloadWysiwyg()
      } else {
        this.onEditorInput()
      }
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
      return this.$el.querySelector('#editor-source')?.value || ''
    },

    setMarkdown(value) {
      const source = this.$el.querySelector('#editor-source')
      if (source) source.value = value
      const ta = this.editorTextarea()
      if (ta) ta.value = value
    },

    onEditorInput() {
      const source = this.$el.querySelector('#editor-source')
      const ta = this.editorTextarea()
      if (source && ta) source.value = ta.value
      this.scheduleAutosave()
      this.syncSlashFromEditor()
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

    initEditor(attempt = 0) {
      const source = this.$el.querySelector('#editor-source')
      const mount = this.editorMountEl()
      if (!source || !mount) {
        if (attempt < 40) setTimeout(() => this.initEditor(attempt + 1), 50)
        return
      }
      if (this.documentKind === 'database') {
        this.initMarkdownEditor(mount, source)
        return
      }
      this.initWysiwygEditor(mount, source, attempt)
    },

    buildToolbar(onAction) {
      const toolbar = document.createElement('div')
      toolbar.className = 'editor-toolbar'
      const items = [
        ['H1', () => onAction('h1')],
        ['H2', () => onAction('h2')],
        ['List', () => onAction('list')],
        ['Task', () => onAction('task')],
        ['Quote', () => onAction('quote')],
        ['Code', () => onAction('code')],
        ['B', () => onAction('bold')],
        ['I', () => onAction('italic')],
      ]
      for (const [label, handler] of items) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.textContent = label
        btn.className = label.length === 1 ? 'toolbar-glyph' : ''
        btn.addEventListener('click', handler)
        toolbar.appendChild(btn)
      }
      return toolbar
    },

    wysiwygWin() {
      return this._wysiwygFrame?.contentWindow || null
    },

    insertWysiwygBlock(key) {
      const win = this.wysiwygWin()
      if (win?.mindbaseInsertBlock) {
        win.mindbaseInsertBlock(key)
        return
      }
      const html = window.MindbaseWysiwygBlocks?.[key]
      if (!html || !win?.mindbaseInsertHtml) return
      win.mindbaseInsertHtml(html)
    },

    applyWysiwygFormat(format) {
      const win = this.wysiwygWin()
      if (win?.mindbaseExecFormat) {
        win.mindbaseExecFormat(format)
        return
      }
      if (!win?.mindbaseExecFormat) return
      win.mindbaseExecFormat(format === 'bold' ? 'bold' : 'italic')
    },

    async loadWysiwygPage(content) {
      const res = await fetch('/editor/wysiwyg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, path: this.documentPath }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.text()
    },

    teardownWysiwyg() {
      if (this._onWysiwygMessage) {
        window.removeEventListener('message', this._onWysiwygMessage)
        this._onWysiwygMessage = null
      }
      this._wysiwygFrame = null
      clearTimeout(this._mdSyncTimer)
    },

    async initWysiwygEditor(mount, source, attempt = 0) {
      if (mount.dataset.editorReady === '1' && this._wysiwygFrame) return
      this.teardownWysiwyg()
      mount.innerHTML = ''
      mount.dataset.editorReady = '1'

      const toolbar = this.buildToolbar((action) => {
        if (action === 'bold' || action === 'italic') {
          this.applyWysiwygFormat(action)
        } else {
          this.insertWysiwygBlock(action)
        }
      })
      toolbar.classList.add('editor-toolbar--float')

      const frameWrap = document.createElement('div')
      frameWrap.className = 'wysiwyg-frame-wrap wysiwyg-frame-wrap--immersive'
      const iframe = document.createElement('iframe')
      iframe.className = 'wysiwyg-frame'
      iframe.title = 'Note editor'
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
      frameWrap.appendChild(iframe)

      mount.append(frameWrap, toolbar)
      this._wysiwygFrame = iframe
      this._editorStatsEl = toolbar.querySelector('.editor-toolbar-stats') || (() => {
        const el = document.createElement('span')
        el.className = 'editor-toolbar-stats'
        toolbar.appendChild(el)
        return el
      })()

      this._onWysiwygMessage = (event) => {
        if (event.source !== iframe.contentWindow) return
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'focus') {
            mount.closest('.rich-editor-wrap')?.classList.add('immersive-active')
            return
          }
          if (msg.type === 'blur') {
            mount.closest('.rich-editor-wrap')?.classList.remove('immersive-active')
            return
          }
          if (msg.type === 'stats' && this._editorStatsEl) {
            this._editorStatsEl.textContent = `${msg.words} words`
            return
          }
          if (msg.type === 'selectionToolbar') {
            mount.closest('.rich-editor-wrap')?.classList.toggle('selection-toolbar-open', !!msg.visible)
            return
          }
          if (msg.type === 'change' && typeof msg.markdown === 'string') {
            this.setMarkdown(msg.markdown)
            this.scheduleAutosave()
            return
          }
          if (msg.type === 'change') {
            this._pendingHtml = msg.html
            this.scheduleMarkdownSync()
          }
        } catch (_) {
          // ignore
        }
      }
      window.addEventListener('message', this._onWysiwygMessage)

      try {
        iframe.srcdoc = await this.loadWysiwygPage(source.value || '')
      } catch (err) {
        mount.innerHTML = `<p class="muted">Editor failed to load: ${escapeHtml(String(err.message || err))}</p>`
        if (attempt < 3) setTimeout(() => this.initEditor(attempt + 1), 200)
      }
    },

    async reloadWysiwyg() {
      const source = this.$el.querySelector('#editor-source')
      const mount = this.editorMountEl()
      if (!source || !mount) return
      delete mount.dataset.editorReady
      await this.initWysiwygEditor(mount, source, 0)
    },

    initMarkdownEditor(mount, source) {
      if (mount.dataset.editorReady === '1' && this.editorTextarea()) return
      mount.innerHTML = ''
      mount.dataset.editorReady = '1'

      const toolbar = this.buildToolbar((action) => {
        const snippets = {
          h1: '# ',
          h2: '## ',
          list: '- ',
          task: '- [ ] ',
          quote: '> ',
          code: '```\n\n```',
        }
        if (snippets[action]) this.insertBlock(snippets[action])
      })

      const textarea = document.createElement('textarea')
      textarea.className = 'editor-markdown-input'
      textarea.spellcheck = true
      textarea.value = source.value || ''
      textarea.addEventListener('input', () => this.onEditorInput())
      textarea.addEventListener('keydown', (e) => this.onEditorKeydown(e))
      textarea.addEventListener('keyup', (e) => this.onEditorKeyup(e))

      mount.append(toolbar, textarea)
      this.onEditorInput()
    },

    scheduleMarkdownSync() {
      clearTimeout(this._mdSyncTimer)
      this._mdSyncTimer = setTimeout(() => this.syncMarkdownFromHtml(), 320)
    },

    async syncMarkdownFromHtml() {
      if (!this._pendingHtml) return
      const html = this._pendingHtml
      try {
        const res = await fetch('/editor/html-to-markdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html }),
        })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        this.setMarkdown(data.markdown || '')
        this.scheduleAutosave()
      } catch (_) {
        // keep last good markdown
      }
    },

    async flushMarkdownSync() {
      const win = this.wysiwygWin()
      if (win?.mindbaseGetMarkdown) {
        this.setMarkdown(win.mindbaseGetMarkdown())
        return
      }
      if (win?.mindbaseFlushSync) {
        win.mindbaseFlushSync()
        return
      }
      const doc = win?.document?.getElementById('doc')
      if (doc) {
        this._pendingHtml = doc.innerHTML
        await this.syncMarkdownFromHtml()
      }
    },

    initRichEditor(attempt = 0) {
      this.initEditor(attempt)
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
      const win = this.wysiwygWin()
      if (win?.mindbaseRunSlashCommand) {
        win.mindbaseRunSlashCommand(cmd.id)
        this.closeSlash()
        return
      }
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
      this.syncTabMeta()
      clearTimeout(this._autosaveTimer)
      this.saveStatus = 'Unsaved'
      this._autosaveTimer = setTimeout(() => this.save(false), 800)
    },

    syncTabMeta() {
      document.dispatchEvent(
        new CustomEvent('mindbase-tab-meta', {
          detail: {
            kind: this.documentKind,
            path: this.documentPath,
            dirty: this.dirty,
            title: this.$el.querySelector('.page-title')?.textContent?.trim(),
          },
        }),
      )
    },

    currentMarkdown() {
      return this.getMarkdown()
    },

    async save(manual = false) {
      if (this.documentKind === 'note') {
        await this.flushMarkdownSync()
      }
      const content = this.currentMarkdown()
      this.saveStatus = 'Saving…'
      const res = await fetch(this.saveUrl(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'HX-Request': 'true' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        this.dirty = false
        this.syncTabMeta()
        this.saveStatus = 'Saved'
        setTimeout(() => { if (!this.dirty) this.saveStatus = '' }, 1500)
      } else {
        this.saveStatus = 'Save failed'
      }
    },

    async deleteDocument() {
      const label = this.documentKind === 'database' ? 'database' : 'page'
      const title = this.$el.querySelector('.page-title')?.textContent?.trim() || this.documentPath
      if (!window.confirm(`Delete this ${label} "${title}"? This cannot be undone.`)) return
      const url =
        this.documentKind === 'database'
          ? `/api/databases/${encodeURIComponent(this.documentPath)}`
          : `/api/notes/${encodeURIComponent(this.documentPath)}`
      const res = await fetch(url, { method: 'DELETE', headers: { 'HX-Request': 'true' } })
      if (!res.ok) {
        alert((await res.text()) || 'Delete failed')
        return
      }
      this.teardownWysiwyg?.()
      const workspace = document.getElementById('editor-workspace')?._x_dataStack?.[0]
      workspace?.removeDocumentTab?.(this.documentKind, this.documentPath)
      getEditorTabs()?.prepareForMainNavigation?.()
      if (window.htmx) {
        htmx.ajax('GET', '/', { target: '#main-body', swap: 'innerHTML' })
        history.pushState({}, '', '/')
      } else {
        location.href = '/'
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

    async deleteItem(row) {
      if (!row?.dataset) return
      const kind = row.dataset.kind
      const path = row.dataset.path
      const title = row.querySelector('.item-title')?.textContent?.trim() || path
      if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return
      const url =
        kind === 'database'
          ? `/api/databases/${encodeURIComponent(path)}`
          : `/api/notes/${encodeURIComponent(path)}`
      try {
        const res = await fetch(url, { method: 'DELETE', headers: { 'HX-Request': 'true' } })
        if (!res.ok) throw new Error((await res.text()) || res.statusText)
        row.remove()
        const workspace = document.getElementById('editor-workspace')?._x_dataStack?.[0]
        workspace?.removeDocumentTab?.(kind, path)
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
      const active = document.querySelector('.editor-tab-pane.active [data-document-path]')
      if (active?.dataset?.documentPath) return active.dataset.documentPath
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

  Alpine.data('commandPalette', () => ({
    open: false,
    query: '',
    index: 0,
    vaultItems: [],
    _loaded: false,
    _keydownBound: false,

    staticCommands() {
      return [
        { id: 'nav-library', label: 'Go to Library', hint: 'Home', icon: '📚', run: () => this.go('/'), keywords: ['home'] },
        { id: 'nav-journal', label: "Open today's journal", hint: 'Journal', icon: '🗓', run: () => this.go('/journal/today'), keywords: ['today', 'daily'] },
        { id: 'nav-week', label: 'Open weekly journal', hint: 'Journal', icon: '📅', run: () => this.go('/journal/week'), keywords: ['week'] },
        { id: 'nav-tasks', label: 'Open tasks inbox', hint: 'All open tasks', icon: '☑', run: () => this.go('/tasks'), keywords: ['todo', 'tasks'] },
        { id: 'nav-connect', label: 'Connectors', hint: 'Notion, Drive, AI', icon: '🔗', run: () => this.go('/connectors'), keywords: ['sync', 'notion', 'gdrive'] },
        { id: 'nav-settings', label: 'Settings', hint: 'Vault and preferences', icon: '⚙', run: () => this.go('/settings'), keywords: ['preferences', 'vault', 'config'] },
        { id: 'action-ai', label: 'Ask AI assistant', hint: 'Claude', icon: '✦', run: () => window.dispatchEvent(new CustomEvent('open-ai')), keywords: ['claude', 'chat'] },
      ]
    },

    init() {
      if (this._keydownBound) return
      this._keydownBound = true
      window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'p')) {
          e.preventDefault()
          this.toggle()
          return
        }
        if (!this.open) return
        if (e.key === 'Escape') {
          e.preventDefault()
          this.close()
        }
      })
    },

    toggle() {
      if (this.open) this.close()
      else this.openPalette()
    },

    async openPalette() {
      this.open = true
      this.query = ''
      this.index = 0
      if (!this._loaded) await this.loadVaultItems()
      this.$nextTick(() => {
        const input = this.$refs.input
        if (input) {
          input.focus()
          input.select()
        }
      })
    },

    close() {
      this.open = false
      this.query = ''
      this.index = 0
    },

    async loadVaultItems() {
      try {
        const [notes, dbs] = await Promise.all([
          fetch('/api/notes/').then((r) => r.json()),
          fetch('/api/databases/').then((r) => r.json()),
        ])
        const items = []
        for (const note of notes || []) {
          items.push({
            id: `note:${note.path}`,
            label: note.title || note.path,
            hint: note.path,
            icon: '📄',
            kind: 'note',
            path: note.path,
            keywords: [note.path, note.title],
            run: () => this.openDocument('note', note.path),
          })
        }
        for (const db of dbs || []) {
          items.push({
            id: `db:${db.name}`,
            label: db.name,
            hint: 'database',
            icon: '🗃',
            kind: 'database',
            path: db.name,
            keywords: [db.name, 'database', 'csv'],
            run: () => this.openDocument('database', db.name),
          })
        }
        this.vaultItems = items
        this._loaded = true
      } catch {
        this.vaultItems = []
      }
    },

    allCommands() {
      return [...this.staticCommands(), ...this.vaultItems]
    },

    filtered() {
      const q = (this.query || '').trim().toLowerCase()
      const cmds = this.allCommands()
      if (!q) return cmds.slice(0, 24)
      return cmds
        .filter((cmd) => {
          const hay = [cmd.label, cmd.hint, ...(cmd.keywords || [])].join(' ').toLowerCase()
          return hay.includes(q) || q.split(/\s+/).every((part) => hay.includes(part))
        })
        .slice(0, 24)
    },

    move(delta) {
      const list = this.filtered()
      if (!list.length) return
      this.index = (this.index + delta + list.length) % list.length
    },

    runSelected() {
      const list = this.filtered()
      const item = list[this.index]
      if (item) this.run(item)
    },

    run(item) {
      this.close()
      item.run?.()
    },

    go(url) {
      const tabs = getEditorTabs()
      tabs?.prepareForMainNavigation?.()
      if (window.htmx) {
        htmx.ajax('GET', url, { target: '#main-body', swap: 'innerHTML' })
        history.pushState({}, '', url)
      } else {
        location.href = url
      }
    },

    openDocument(kind, path) {
      const workspace = document.getElementById('editor-workspace')
      const tabs = workspace?._x_dataStack?.[0]
      if (tabs?.openDocument) {
        void tabs.openDocument(kind, path)
        return
      }
      this.go(kind === 'database' ? `/databases/${path}` : `/notes/${path}`)
    },
  }))

  Alpine.data('editorTabs', () => ({
    tabs: [],
    activeId: null,
    _panesEl: null,
    _mainEl: null,
    _mainBody: null,
    _boundHtmx: false,
    _ready: false,

    init() {
      this._panesEl = document.getElementById('editor-panes')
      this._mainEl = document.getElementById('main')
      this._mainBody = document.getElementById('main-body')
      this.restoreSession()
      if (!this._boundHtmx) {
        this._boundHtmx = true
        document.body.addEventListener('htmx:beforeRequest', (e) => this.onHtmxBeforeRequest(e))
        document.body.addEventListener('click', (e) => this.onNavLinkClick(e), true)
        document.addEventListener('mindbase-tab-meta', (e) => this.onTabMeta(e.detail))
        window.addEventListener('popstate', () => this.onPopState())
      }
      this.$nextTick(async () => {
        this.captureInitialDocument()
        await this.remountRestoredTabs()
        await this.syncFromLocation()
        this._ready = true
      })
    },

    isMainShellRoute(url) {
      if (!url) return false
      let path = url
      try {
        const parsed = new URL(url, location.origin)
        path = parsed.pathname
      } catch (_) {
        path = String(url).split('?')[0]
      }
      if (path === '/' || path === '/connectors' || path === '/settings') return true
      if (path.startsWith('/journal')) return true
      if (path === '/tasks') return true
      if (path.startsWith('/tags/')) return true
      if (path.startsWith('/search')) return true
      return false
    },

    prepareForMainNavigation() {
      if (!this.tabs.length) return
      for (const tab of [...this.tabs]) {
        const pane = this.getPane(tab.id)
        this.paneState(pane)?.teardownWysiwyg?.()
        pane?.remove()
      }
      this.tabs = []
      this.activeId = null
      this.updateWorkspaceLayout()
      this.persistSession()
    },

    async navigateMain(url, opts = {}) {
      this.prepareForMainNavigation()
      const res = await fetch(url, { headers: { 'HX-Request': 'true' } })
      if (!res.ok) {
        location.href = url
        return
      }
      const html = await res.text()
      if (this._mainBody) {
        this._mainBody.innerHTML = html
        if (typeof Alpine !== 'undefined' && Alpine.initTree) Alpine.initTree(this._mainBody)
        reinitMainEditor(this._mainBody)
      }
      if (opts.pushState !== false && location.pathname + location.search !== url) {
        history.pushState({}, '', url)
      }
      this.updateWorkspaceLayout()
    },

    async remountRestoredTabs() {
      for (const tab of [...this.tabs]) {
        if (!this.getPane(tab.id)) {
          try {
            await this.mountPane(tab)
          } catch {
            this.tabs = this.tabs.filter((t) => t.id !== tab.id)
          }
        }
      }
      const active =
        this.activeId && this.tabs.some((t) => t.id === this.activeId)
          ? this.activeId
          : this.tabs[this.tabs.length - 1]?.id
      if (active) await this.activateTab(active, { pushState: false })
    },

    onPopState() {
      const doc = this.parseDocumentUrl(location.pathname)
      if (!doc && this.tabs.length > 0 && this.isMainShellRoute(location.pathname + location.search)) {
        void this.navigateMain(location.pathname + location.search, { pushState: false })
        return
      }
      void this.syncFromLocation()
    },

    tabKey(kind, path) {
      return `${kind}:${path}`
    },

    parseDocumentUrl(url) {
      if (!url) return null
      let path = url
      try {
        path = new URL(url, location.origin).pathname
      } catch (_) {
        // relative path
      }
      const noteMatch = path.match(/^\/notes\/(.+?)\/?$/)
      if (noteMatch) return { kind: 'note', path: decodeURIComponent(noteMatch[1]) }
      const dbMatch = path.match(/^\/databases\/(.+?)\/?$/)
      if (dbMatch) return { kind: 'database', path: decodeURIComponent(dbMatch[1]) }
      return null
    },

    restoreSession() {
      try {
        const raw = sessionStorage.getItem('mindbase-editor-tabs')
        if (!raw) return
        const data = JSON.parse(raw)
        if (Array.isArray(data.tabs)) this.tabs = data.tabs
        if (data.activeId) this.activeId = data.activeId
      } catch (_) {
        // ignore corrupt session
      }
    },

    persistSession() {
      try {
        sessionStorage.setItem(
          'mindbase-editor-tabs',
          JSON.stringify({ tabs: this.tabs.map(({ id, kind, path, title, dirty }) => ({ id, kind, path, title, dirty })), activeId: this.activeId }),
        )
      } catch (_) {
        // ignore quota errors
      }
    },

    captureInitialDocument() {
      const docEl = this._mainBody?.querySelector('[data-document-kind]')
      if (!docEl || this.getPane(this.tabKey(docEl.dataset.documentKind || 'note', docEl.dataset.documentPath || ''))) return
      const kind = docEl.dataset.documentKind || 'note'
      const path = docEl.dataset.documentPath || ''
      if (!path) return
      const title = docEl.querySelector('.page-title')?.textContent?.trim() || path.split('/').pop() || path
      const id = this.tabKey(kind, path)
      if (!this.tabs.find((t) => t.id === id)) {
        this.tabs.push({ id, kind, path, title, dirty: false })
      }
      this.activeId = id
      const pane = document.createElement('div')
      pane.className = 'editor-tab-pane active'
      pane.dataset.tabId = id
      const root = docEl.closest('.note-view') || docEl
      pane.appendChild(root)
      this._panesEl?.appendChild(pane)
      this.updateWorkspaceLayout()
      this.persistSession()
    },

    getPane(tabId) {
      return this._panesEl?.querySelector(`.editor-tab-pane[data-tab-id="${CSS.escape(tabId)}"]`) || null
    },

    paneState(pane) {
      const docEl = pane?.querySelector('[data-document-kind]')
      return docEl?._x_dataStack?.[0] || null
    },

    async snapshotActiveTab() {
      if (!this.activeId) return
      const tab = this.tabs.find((t) => t.id === this.activeId)
      const pane = this.getPane(this.activeId)
      if (!tab || !pane) return
      const state = this.paneState(pane)
      if (state?.documentKind === 'note') await state.flushMarkdownSync?.()
      if (state?.getMarkdown) tab.markdown = state.getMarkdown()
      tab.dirty = Boolean(state?.dirty)
      const titleEl = pane.querySelector('.page-title')
      if (titleEl?.textContent) tab.title = titleEl.textContent.trim()
    },

    updateWorkspaceLayout() {
      const open = this.tabs.length > 0 && this.activeId
      this._mainEl?.classList.toggle('editor-tabs-open', Boolean(open))
    },

    async openDocument(kind, path, opts = {}) {
      const id = this.tabKey(kind, path)
      const existing = this.tabs.find((t) => t.id === id)
      if (existing && !opts.forceNew) {
        await this.activateTab(existing.id, opts)
        return
      }

      await this.snapshotActiveTab()

      let title = path.split('/').pop() || path
      if (kind === 'database') title = title.replace(/\.csv$/i, '') || title

      const tab = { id, kind, path, title, dirty: false }
      this.tabs.push(tab)
      await this.mountPane(tab)
      await this.activateTab(id, opts)
      this.persistSession()
    },

    async mountPane(tab) {
      if (this.getPane(tab.id)) return
      const url = tab.kind === 'database' ? `/databases/${tab.path}` : `/notes/${tab.path}`
      const res = await fetch(url, { headers: { 'HX-Request': 'true' } })
      if (!res.ok) throw new Error(`Could not open ${tab.path}`)
      const html = await res.text()
      const pane = document.createElement('div')
      pane.className = 'editor-tab-pane'
      pane.dataset.tabId = tab.id
      pane.innerHTML = html
      this._panesEl?.appendChild(pane)
      if (typeof Alpine !== 'undefined' && Alpine.initTree) Alpine.initTree(pane)
      reinitMainEditor(pane)
      const titleEl = pane.querySelector('.page-title')
      if (titleEl?.textContent) tab.title = titleEl.textContent.trim()
    },

    async activateTab(tabId, opts = {}) {
      if (this.activeId === tabId && this.getPane(tabId)?.classList.contains('active')) {
        if (opts.pushState !== false) this.pushDocumentUrl(tabId)
        return
      }
      await this.snapshotActiveTab()
      this.activeId = tabId
      for (const pane of this._panesEl?.querySelectorAll('.editor-tab-pane') || []) {
        pane.classList.toggle('active', pane.dataset.tabId === tabId)
      }
      this.updateWorkspaceLayout()
      if (opts.pushState !== false) this.pushDocumentUrl(tabId)
      this.persistSession()
      const pane = this.getPane(tabId)
      if (pane) reinitMainEditor(pane)
    },

    pushDocumentUrl(tabId) {
      const tab = this.tabs.find((t) => t.id === tabId)
      if (!tab) return
      const url = tab.kind === 'database' ? `/databases/${tab.path}` : `/notes/${tab.path}`
      if (location.pathname + location.search !== url) {
        history.pushState({ mindbaseTab: tabId }, '', url)
      }
    },

    syncFromLocation() {
      const doc = this.parseDocumentUrl(location.pathname)
      if (!doc) {
        this.updateWorkspaceLayout()
        return
      }
      const id = this.tabKey(doc.kind, doc.path)
      const tab = this.tabs.find((t) => t.id === id)
      if (tab) {
        void this.activateTab(tab.id, { pushState: false })
        return
      }
      void this.openDocument(doc.kind, doc.path, { pushState: false })
    },

    removeDocumentTab(kind, path) {
      const id = this.tabKey(kind, path)
      const pane = this.getPane(id)
      const state = this.paneState(pane)
      state?.teardownWysiwyg?.()
      pane?.remove()
      this.tabs = this.tabs.filter((t) => t.id !== id)
      if (this.activeId === id) {
        this.activeId = this.tabs[this.tabs.length - 1]?.id ?? null
        this.updateWorkspaceLayout()
      }
      this.persistSession()
    },

    async closeTab(tabId) {
      const tab = this.tabs.find((t) => t.id === tabId)
      if (!tab) return
      const pane = this.getPane(tabId)
      const state = this.paneState(pane)
      if (state?.dirty) {
        const ok = window.confirm(`Close "${tab.title}" with unsaved changes?`)
        if (!ok) return
      }
      state?.teardownWysiwyg?.()
      pane?.remove()
      this.tabs = this.tabs.filter((t) => t.id !== tabId)
      if (this.activeId === tabId) {
        const next = this.tabs[this.tabs.length - 1]
        if (next) await this.activateTab(next.id)
        else {
          this.activeId = null
          this.updateWorkspaceLayout()
          history.pushState({}, '', '/')
        }
      }
      this.persistSession()
    },

    onTabMeta(detail) {
      if (!detail?.path) return
      const id = this.tabKey(detail.kind || 'note', detail.path)
      const tab = this.tabs.find((t) => t.id === id)
      if (!tab) return
      if (detail.dirty !== undefined) tab.dirty = Boolean(detail.dirty)
      if (detail.title) tab.title = detail.title
    },

    onNavLinkClick(e) {
      const anchor = e.target.closest('a[href^="/"]')
      if (!anchor || anchor.target === '_blank') return
      if (e.metaKey || e.ctrlKey || e.button === 1 || e.shiftKey) return

      const href = anchor.getAttribute('href') || ''
      const doc = this.parseDocumentUrl(href)
      if (doc) {
        e.preventDefault()
        e.stopPropagation()
        void this.openDocument(doc.kind, doc.path)
        return
      }

      if (!this.isMainShellRoute(href)) return
      if (anchor.hasAttribute('hx-get')) return

      e.preventDefault()
      e.stopPropagation()
      void this.navigateMain(href)
    },

    onHtmxBeforeRequest(e) {
      const target = e.detail.target
      if (!target || (target.id !== 'main-body' && target.id !== 'main')) return
      const path = e.detail.pathInfo?.requestPath || e.detail.requestConfig?.path
      const doc = this.parseDocumentUrl(path)
      if (doc) {
        e.preventDefault()
        void this.openDocument(doc.kind, doc.path)
        return
      }
      this.prepareForMainNavigation()
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

function reinitMainEditor(mainEl) {
  if (!mainEl) return
  if (typeof Alpine !== 'undefined' && Alpine.initTree) {
    Alpine.initTree(mainEl)
  }
  requestAnimationFrame(() => {
    const docEl = mainEl.querySelector('[data-document-kind]')
    if (!docEl) return
    const state = docEl._x_dataStack?.[0]
    const mount = state?.editorMountEl?.()
    if (mount) delete mount.dataset.editorReady
    state?.teardownWysiwyg?.()
    if (state?.initEditor) state.initEditor(0)
  })
}

document.body.addEventListener('htmx:afterSettle', (e) => {
  const target = e.detail.target
  if (!target) return
  if (target.id === 'main-body') {
    if (typeof Alpine !== 'undefined' && Alpine.initTree) Alpine.initTree(target)
    reinitMainEditor(target)
    return
  }
  if (target.id === 'main') {
    const body = target.querySelector('#main-body')
    if (body) {
      if (typeof Alpine !== 'undefined' && Alpine.initTree) Alpine.initTree(body)
      reinitMainEditor(body)
    }
  }
})

window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return
  const main = document.getElementById('main')
  if (main) reinitMainEditor(main)
})

document.addEventListener('DOMContentLoaded', () => {
  if (location.protocol === 'file:') {
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

async function deleteAttachment(notePath, name) {
  if (!notePath || !name) return
  if (!window.confirm(`Delete attachment "${name}"?`)) return
  try {
    const res = await fetch(
      `/api/attachments/${encodeURIComponent(notePath)}/${encodeURIComponent(name)}`,
      { method: 'DELETE', headers: { 'HX-Request': 'true' } },
    )
    if (!res.ok) throw new Error((await res.text()) || res.statusText)
    document
      .querySelectorAll(`.attachment-delete-btn[data-note-path="${CSS.escape(notePath)}"][data-name="${CSS.escape(name)}"]`)
      .forEach((btn) => {
        const row = btn.closest('.attachment-row')
        const list = row?.closest('#attachment-list')
        row?.remove()
        if (list && !list.querySelector('.attachment-row')) {
          list.innerHTML = '<p class="attachments-empty muted">No attachments yet — drop a file above.</p>'
        }
        const panel = btn.closest('.attachments-panel')
        const badge = panel?.querySelector('.attachments-count')
        const n = panel?.querySelectorAll('.attachment-row')?.length ?? 0
        if (n === 0) badge?.remove()
        else if (badge) badge.textContent = String(n)
      })
  } catch (e) {
    alert(String(e.message || e))
  }
}

window.mindbaseAttachments = {
  ref(notePath, name) {
    const base = notePath.replace(/\.md$/i, '')
    return `![${name}](${base}.attachments/${name})`
  },

  findEditor(notePath) {
    const root = document.querySelector(`[data-document-path="${CSS.escape(notePath)}"]`)
    return root?._x_dataStack?.[0] ?? null
  },

  insert(notePath, name) {
    const md = this.ref(notePath, name)
    const ed = this.findEditor(notePath)
    if (ed?.insertBlock) {
      ed.insertBlock(`${md}\n`)
      return
    }
    void this.copyRef(notePath, name)
  },

  async copyRef(notePath, name) {
    const md = this.ref(notePath, name)
    try {
      await navigator.clipboard.writeText(md)
    } catch {
      window.prompt('Copy markdown reference:', md)
    }
  },
}

async function revealVault() {
  try {
    const res = await fetch('/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'vault', path: '' }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || res.statusText)
    }
  } catch (e) {
    alert(String(e.message || e))
  }
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
