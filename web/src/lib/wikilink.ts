// Wiki-link helpers shared by the preview renderer and the editor bridge.
// Syntax mirrors the backend/editor: [[target]] or [[target|label]].

export const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

/** Turn a wiki-link target (e.g. "projects/idea") into a note path. */
export function wikiTargetToPath(target: string): string {
  const t = target.trim().replace(/^\/+/, '')
  return /\.md$/i.test(t) ? t : `${t}.md`
}

/** Turn a note path (e.g. "projects/idea.md") into a wiki-link target. */
export function pathToWikiTarget(path: string): string {
  return path.replace(/\.md$/i, '')
}

/**
 * Rewrite [[wiki-links]] in markdown to standard links with a `wiki:` scheme so
 * react-markdown renders them; the renderer intercepts that scheme to navigate
 * in-app instead of following an href.
 */
export function wikiLinksToMarkdown(src: string): string {
  return src.replace(WIKI_LINK_RE, (_m, target: string, label?: string) => {
    const text = (label ?? target).trim()
    return `[${text}](wiki:${encodeURIComponent(target.trim())})`
  })
}

export const WIKI_SCHEME = 'wiki:'
