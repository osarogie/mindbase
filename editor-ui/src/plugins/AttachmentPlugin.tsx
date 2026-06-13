import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { DRAG_DROP_PASTE } from '@lexical/rich-text'
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FOCUS_COMMAND,
  createCommand,
  type LexicalCommand,
  type LexicalNode,
} from 'lexical'
import { useEffect, useRef } from 'react'
import { isImagePath, useAttachmentHost } from '../attachments/host'
import { postBridge } from '../bridge'
import { $createFileCardNode, $isFileCardNode, FileCardNode } from '../nodes/FileCardNode'
import { $createImageNode, $isImageNode, ImageNode } from '../nodes/ImageNode'

export const INSERT_ATTACHMENT_COMMAND: LexicalCommand<{ path: string; label?: string }> =
  createCommand('INSERT_ATTACHMENT_COMMAND')

function $insertInline(node: LexicalNode) {
  const selection = $getSelection()
  if ($isRangeSelection(selection)) {
    selection.insertNodes([node])
    return
  }
  const last = $getRoot().getLastChild()
  if ($isElementNode(last)) {
    last.append(node)
    return
  }
  const p = $createParagraphNode()
  p.append(node)
  $getRoot().append(p)
}

/** Insert an ImageNode or FileCardNode (chosen by extension) at the selection. Must run inside editor.update(). Label is the visible alt/label text — FileCardNode display falls back to the decoded filename when empty. */
export function $insertAttachmentNode(path: string, label = ''): ImageNode | FileCardNode {
  const node = isImagePath(path) ? $createImageNode(path, label) : $createFileCardNode(path, label)
  $insertInline(node)
  return node
}

export function AttachmentPlugin() {
  const [editor] = useLexicalComposerContext()
  const host = useAttachmentHost()
  // Whether the editor has ever held focus. If not, the selection is still the
  // default doc-start position, so a programmatic insert (e.g. the footer
  // attachments panel) should land at the end of the document, not the top.
  const everFocused = useRef(false)

  useEffect(
    () =>
      editor.registerCommand(
        FOCUS_COMMAND,
        () => {
          everFocused.current = true
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor],
  )

  useEffect(() => {
    window.mindbaseInsertAttachment = (path: string) => {
      editor.dispatchCommand(INSERT_ATTACHMENT_COMMAND, { path })
    }
    return () => {
      delete window.mindbaseInsertAttachment
    }
  }, [editor])

  useEffect(() => {
    return editor.registerCommand(
      INSERT_ATTACHMENT_COMMAND,
      ({ path, label }) => {
        editor.update(() => {
          // Never-focused editor: drop the stale doc-start selection so the
          // attachment is appended at the end instead of the top.
          if (!everFocused.current) $getRoot().selectEnd()
          $insertAttachmentNode(path, label)
        })
        return true
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor])

  useEffect(() => {
    if (!host) return
    return editor.registerCommand(
      DRAG_DROP_PASTE,
      (files: File[]) => {
        void (async () => {
          for (const file of files) {
            let pendingKey = ''
            editor.update(() => {
              // Empty src renders the "Uploading…" placeholder; the markdown
              // transformer exports empty-src nodes as '' so a racing autosave
              // never persists a half-uploaded embed.
              const pending = isImagePath(file.name)
                ? $createImageNode('', file.name)
                : $createFileCardNode('', file.name)
              pendingKey = pending.getKey()
              $insertInline(pending)
            })
            try {
              const { path } = await host.upload(file)
              editor.update(() => {
                const node = $getNodeByKey(pendingKey)
                if ($isImageNode(node) || $isFileCardNode(node)) node.setSrc(path)
              })
              postBridge({ type: 'attachment-uploaded', path })
            } catch (err) {
              editor.update(() => {
                $getNodeByKey(pendingKey)?.remove()
              })
              postBridge({ type: 'attachment-error', message: String(err) })
            }
          }
        })()
        return true
      },
      COMMAND_PRIORITY_LOW,
    )
  }, [editor, host])

  return null
}
