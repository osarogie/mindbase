import { createHeadlessEditor } from '@lexical/headless'
import { $getRoot, $createParagraphNode } from 'lexical'
import { describe, expect, it } from 'vitest'
import { $createImageNode, $isImageNode, ImageNode } from './ImageNode'
import { $createFileCardNode, $isFileCardNode, FileCardNode } from './FileCardNode'

function makeEditor() {
  return createHeadlessEditor({
    namespace: 'test',
    nodes: [ImageNode, FileCardNode],
    onError: (e) => { throw e },
  })
}

describe('ImageNode', () => {
  it('stores src/alt, is inline, survives JSON round-trip', () => {
    const editor = makeEditor()
    editor.update(() => {
      const node = $createImageNode('welcome.attachments/p.png', 'pic')
      expect($isImageNode(node)).toBe(true)
      expect(node.getSrc()).toBe('welcome.attachments/p.png')
      expect(node.getAlt()).toBe('pic')
      expect(node.isInline()).toBe(true)
      const json = node.exportJSON()
      const back = ImageNode.importJSON(json)
      expect(back.getSrc()).toBe('welcome.attachments/p.png')
      expect(back.getAlt()).toBe('pic')
      const p = $createParagraphNode()
      p.append(node)
      $getRoot().append(p)
    }, { discrete: true })
  })

  it('setSrc updates the writable node', () => {
    const editor = makeEditor()
    editor.update(() => {
      const node = $createImageNode('', 'pending.png')
      const p = $createParagraphNode()
      p.append(node)
      $getRoot().append(p)
      node.setSrc('x.attachments/pending.png')
      expect(node.getSrc()).toBe('x.attachments/pending.png')
    }, { discrete: true })
  })

  it('importJSON uses defensive defaults for missing fields', () => {
    const editor = makeEditor()
    editor.update(() => {
      const node = ImageNode.importJSON({ type: 'mb-image', version: 1 } as never)
      expect(node.getSrc()).toBe('')
      expect(node.getAlt()).toBe('')
    }, { discrete: true })
  })
})

describe('FileCardNode', () => {
  it('stores src/label, is inline, survives JSON round-trip', () => {
    const editor = makeEditor()
    editor.update(() => {
      const node = $createFileCardNode('welcome.attachments/r.pdf', 'r.pdf')
      expect($isFileCardNode(node)).toBe(true)
      expect(node.getSrc()).toBe('welcome.attachments/r.pdf')
      expect(node.getLabel()).toBe('r.pdf')
      expect(node.isInline()).toBe(true)
      const back = FileCardNode.importJSON(node.exportJSON())
      expect(back.getSrc()).toBe('welcome.attachments/r.pdf')
      expect(back.getLabel()).toBe('r.pdf')
      const p = $createParagraphNode()
      p.append(node)
      $getRoot().append(p)
    }, { discrete: true })
  })

  it('importJSON uses defensive defaults for missing fields', () => {
    const editor = makeEditor()
    editor.update(() => {
      const node = FileCardNode.importJSON({ type: 'mb-file-card', version: 1 } as never)
      expect(node.getLabel()).toBe('')
    }, { discrete: true })
  })
})
