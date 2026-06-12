import type { TextMatchTransformer } from '@lexical/markdown'
import { attachmentFilename, isImagePath } from '../attachments/host'
import { $createFileCardNode, $isFileCardNode, FileCardNode } from '../nodes/FileCardNode'
import { $createImageNode, $isImageNode, ImageNode } from '../nodes/ImageNode'

const EMBED_IMPORT = /!\[([^\]]*)\]\(([^()\s]+)\)/
const EMBED_TYPED = /!\[([^\]]*)\]\(([^()\s]+)\)$/

export const ATTACHMENT_EMBED: TextMatchTransformer = {
  dependencies: [ImageNode, FileCardNode],
  export: (node) => {
    if ($isImageNode(node)) {
      if (!node.getSrc()) return '' // pending upload — never persist
      return `![${node.getAlt()}](${node.getSrc()})`
    }
    if ($isFileCardNode(node)) {
      if (!node.getSrc()) return ''
      return `![${node.getLabel()}](${node.getSrc()})`
    }
    return null
  },
  importRegExp: EMBED_IMPORT,
  regExp: EMBED_TYPED,
  replace: (textNode, match) => {
    const alt = match[1]
    const src = match[2]
    const node = isImagePath(src)
      ? $createImageNode(src, alt)
      : $createFileCardNode(src, alt || attachmentFilename(src))
    textNode.replace(node)
  },
  trigger: ')',
  type: 'text-match',
}
