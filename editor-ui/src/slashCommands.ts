export type SlashDocumentKind = 'note' | 'database'

export interface SlashCommand {
  id: string
  label: string
  hint: string
  icon: string
  keywords: string[]
  /** Markdown snippet or plain text inserted at cursor. */
  insert?: string
  /** Structured block handled by editorCommands. */
  block?: string
}

const COMMON: SlashCommand[] = [
  { id: 'h1', label: 'Heading 1', hint: '# at line start', icon: 'H1', keywords: ['heading', 'h1', 'title'], block: 'h1' },
  { id: 'h2', label: 'Heading 2', hint: '## section', icon: 'H2', keywords: ['heading', 'h2', 'section'], block: 'h2' },
  { id: 'h3', label: 'Heading 3', hint: '### subsection', icon: 'H3', keywords: ['heading', 'h3'], block: 'h3' },
  { id: 'bullet', label: 'Bullet list', hint: 'Unordered list', icon: '•', keywords: ['bullet', 'list', 'ul'], block: 'list' },
  { id: 'numbered', label: 'Numbered list', hint: 'Ordered list', icon: '1.', keywords: ['numbered', 'ordered', 'ol'], block: 'ordered' },
  { id: 'todo', label: 'To-do', hint: 'Checkbox task', icon: '☐', keywords: ['todo', 'task', 'checkbox'], block: 'task' },
  { id: 'quote', label: 'Quote', hint: 'Blockquote', icon: '❝', keywords: ['quote', 'blockquote'], block: 'quote' },
  { id: 'code', label: 'Code block', hint: 'Fenced code', icon: '</>', keywords: ['code', 'snippet'], block: 'code' },
  { id: 'divider', label: 'Divider', hint: 'Horizontal rule', icon: '—', keywords: ['divider', 'hr', 'line'], insert: '\n---\n' },
  {
    id: 'table',
    label: 'Table',
    hint: 'Markdown table',
    icon: '⊞',
    keywords: ['table', 'grid'],
    insert: '\n| col | col |\n| --- | --- |\n| | |\n',
  },
  { id: 'link', label: 'Link', hint: '[text](url)', icon: '↗', keywords: ['link', 'url', 'href'], insert: '[label](https://)' },
  { id: 'image', label: 'Image', hint: 'Markdown image', icon: '🖼', keywords: ['image', 'img', 'photo'], insert: '![alt](path/to/image.png)' },
  { id: 'callout', label: 'Callout', hint: 'Highlighted note', icon: '💡', keywords: ['callout', 'note', 'tip'], insert: '> **Note:** ' },
  {
    id: 'frontmatter',
    label: 'Frontmatter',
    hint: 'YAML metadata',
    icon: 'fm',
    keywords: ['yaml', 'frontmatter', 'meta'],
    insert: '---\ntitle: \ntags: []\n---\n\n',
  },
]

const NOTE: SlashCommand[] = [
  {
    id: 'scheduled',
    label: 'Scheduled task',
    hint: '>today #tag',
    icon: '◷',
    keywords: ['schedule', 'today'],
    insert: '- [ ] Task >today #project',
  },
  { id: 'tag', label: 'Tag', hint: '#project', icon: '#', keywords: ['tag'], insert: '#tag ' },
  { id: 'mention', label: 'Mention', hint: '@context', icon: '@', keywords: ['mention', 'context'], insert: '@context ' },
  { id: 'wikilink', label: 'Wiki link', hint: '[[page]]', icon: '🔗', keywords: ['link', 'wiki', 'page'], insert: '[[welcome]]' },
  { id: 'dbembed', label: 'Database embed', hint: '[[db:name]]', icon: '🗃', keywords: ['database', 'db'], insert: '[[db:projects]]' },
  {
    id: 'mermaid',
    label: 'Mermaid diagram',
    hint: 'Flowchart',
    icon: '◈',
    keywords: ['mermaid', 'diagram'],
    insert: '```mermaid\ngraph TD\n  A-->B\n```\n',
  },
]

const DATABASE: SlashCommand[] = [
  { id: 'dbrow', label: 'Table row', hint: 'New data row', icon: '+', keywords: ['row'], insert: '| value | value |' },
  { id: 'dbheader', label: 'Section heading', hint: 'Inside database md', icon: 'H2', keywords: ['heading'], block: 'h2' },
]

export function slashCommandsFor(kind: SlashDocumentKind = 'note'): SlashCommand[] {
  if (kind === 'database') return [...COMMON, ...DATABASE]
  return [...COMMON, ...NOTE]
}

export function filterSlashCommands(commands: SlashCommand[], query: string): SlashCommand[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  return commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.includes(q) || q.includes(k)),
  )
}
