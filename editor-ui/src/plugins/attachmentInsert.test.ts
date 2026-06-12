import { createHeadlessEditor } from '@lexical/headless'
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
})
