import type { TextMatchTransformer } from '@lexical/markdown'
import { isImagePath } from '../attachments/host'
import { $createFileCardNode, $isFileCardNode, FileCardNode } from '../nodes/FileCardNode'
import { $createImageNode, $isImageNode, ImageNode } from '../nodes/ImageNode'

const EMBED_IMPORT = /!\[([^\]]*)\]\(([^()\s]+)(?:\s+"([^"]*)")?\)/
const EMBED_TYPED = /!\[([^\]]*)\]\(([^()\s]+)(?:\s+"([^"]*)")?\)$/

/**
 * Make exported markdown guaranteed to re-match EMBED_IMPORT.
 *
 * A `]` in alt/label text makes the exported `![…](…)` unparseable by our
 * import regex; on re-import the generic LINK transformer claims the syntax
 * instead and rewrites relative srcs to absolute `https://` URLs, destroying
 * the attachment path. Brackets in alt text are cosmetic, so we drop them.
 */
function sanitizeAltText(text: string): string {
  return text.replace(/[[\]]/g, '')
}

/**
 * Whitespace or parens in src would also fail to re-match EMBED_IMPORT (the
 * src group is `[^()\s]+`), so percent-encode exactly those characters on
 * export. Note encodeURIComponent leaves `(` and `)` untouched, so parens are
 * encoded explicitly.
 */
function sanitizeSrc(src: string): string {
  return src.replace(/[\s()]/g, (c) => (c === '(' ? '%28' : c === ')' ? '%29' : encodeURIComponent(c)))
}

export const ATTACHMENT_EMBED: TextMatchTransformer = {
  dependencies: [ImageNode, FileCardNode],
  export: (node) => {
    if (!$isImageNode(node) && !$isFileCardNode(node)) return null
    const src = node.getSrc()
    if (!src) return '' // pending upload — never persist
    const text = sanitizeAltText($isImageNode(node) ? node.getAlt() : node.getLabel())
    // A `"` inside the quoted title would terminate it early and corrupt the
    // syntax; titles are cosmetic, so strip quotes rather than escape them.
    const title = node.getTitle().replace(/"/g, '')
    const suffix = title ? ` "${title}"` : ''
    return `![${text}](${sanitizeSrc(src)}${suffix})`
  },
  importRegExp: EMBED_IMPORT,
  regExp: EMBED_TYPED,
  replace: (textNode, match) => {
    const alt = match[1]
    const src = match[2]
    const title = match[3] ?? ''
    // Label is exactly the alt text (possibly '') so empty-alt embeds stay
    // byte-stable across saves; FileCardComponent falls back to the decoded
    // filename for display.
    const node = isImagePath(src)
      ? $createImageNode(src, alt, title)
      : $createFileCardNode(src, alt, title)
    textNode.replace(node)
  },
  trigger: ')',
  type: 'text-match',
}
