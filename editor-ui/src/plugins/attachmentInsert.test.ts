import { createHeadlessEditor } from '@lexical/headless'
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $setSelection,
} from 'lexical'
import { describe, expect, it } from 'vitest'
import { FileCardNode } from '../nodes/FileCardNode'
import { ImageNode } from '../nodes/ImageNode'
import { $insertAttachmentNode } from './AttachmentPlugin'

function makeEditor() {
  return createHeadlessEditor({
    namespace: 'test',
    nodes: [ImageNode, FileCardNode],
    onError: (e) => { throw e },
  })
}

describe('$insertAttachmentNode', () => {
  it('inserts an ImageNode for image paths', () => {
    const editor = makeEditor()
    editor.update(() => {
      $insertAttachmentNode('x.attachments/a.png')
    }, { discrete: true })
    expect(JSON.stringify(editor.getEditorState().toJSON())).toContain('mb-image')
  })

  it('inserts a FileCardNode with empty label for other paths (display falls back to filename)', () => {
    const editor = makeEditor()
    editor.update(() => {
      $insertAttachmentNode('x.attachments/r.pdf')
    }, { discrete: true })
    const json = JSON.stringify(editor.getEditorState().toJSON())
    expect(json).toContain('mb-file-card')
    expect(json).toContain('"src":"x.attachments/r.pdf"')
  })

  it('uses an explicit label when given', () => {
    const editor = makeEditor()
    editor.update(() => {
      $insertAttachmentNode('x.attachments/r.pdf', 'Quarterly Report')
    }, { discrete: true })
    expect(JSON.stringify(editor.getEditorState().toJSON())).toContain('"label":"Quarterly Report"')
  })

  // Mirrors the never-focused panel-insert fix: when the editor was never
  // focused the selection is still the default doc-start, so the insert command
  // resets it to the end. With that reset the attachment lands in the LAST
  // paragraph, leaving the first untouched (rather than prepending at the top).
  it('appends at document end when selection is reset to end', () => {
    const editor = makeEditor()
    editor.update(() => {
      const root = $getRoot()
      const p1 = $createParagraphNode()
      p1.append($createTextNode('first'))
      const p2 = $createParagraphNode()
      p2.append($createTextNode('second'))
      root.clear().append(p1, p2)
      // Stale doc-start collapsed selection (as on a never-focused editor).
      const sel = $createRangeSelection()
      sel.anchor.set(p1.getKey(), 0, 'element')
      sel.focus.set(p1.getKey(), 0, 'element')
      $setSelection(sel)
    }, { discrete: true })

    editor.update(() => {
      $getRoot().selectEnd()
      $insertAttachmentNode('x.attachments/a.png')
    }, { discrete: true })

    editor.getEditorState().read(() => {
      const paras = $getRoot().getChildren()
      expect(paras[0].getTextContent()).toBe('first')
      const last = paras[paras.length - 1]
      const hasImage = $isElementNode(last) && last.getChildren().some((n) => n.getType() === 'mb-image')
      expect(hasImage).toBe(true)
    })
  })
})
