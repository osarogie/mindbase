import { describe, expect, it } from 'vitest'
import { attachmentFilename, attachmentMarkdownPath, isImagePath, resolveApiUrl } from './host'

describe('isImagePath', () => {
  it('detects image extensions case-insensitively', () => {
    for (const p of ['a.png', 'b.JPG', 'x.attachments/c.webp', 'd.svg?x=1']) {
      expect(isImagePath(p)).toBe(true)
    }
  })
  it('rejects non-images', () => {
    for (const p of ['a.pdf', 'b.zip', 'noext', 'c.txt']) {
      expect(isImagePath(p)).toBe(false)
    }
  })
})

describe('attachmentFilename', () => {
  it('returns the last path segment without query/hash', () => {
    expect(attachmentFilename('welcome.attachments/photo.png')).toBe('photo.png')
    expect(attachmentFilename('photo.png')).toBe('photo.png')
    expect(attachmentFilename('a/b/c.pdf?dl=1#x')).toBe('c.pdf')
  })
})

describe('attachmentMarkdownPath', () => {
  it('builds the sibling-relative portable path', () => {
    expect(attachmentMarkdownPath('welcome.md', 'photo.png')).toBe('welcome.attachments/photo.png')
    expect(attachmentMarkdownPath('journal/2026-06-11.md', 'a.pdf')).toBe('2026-06-11.attachments/a.pdf')
  })
})

describe('resolveApiUrl', () => {
  it('builds /api/files URLs from both path forms', () => {
    expect(resolveApiUrl('welcome.md', 'welcome.attachments/photo.png')).toBe('/api/files/welcome.md/photo.png')
    expect(resolveApiUrl('welcome.md', 'photo.png')).toBe('/api/files/welcome.md/photo.png')
    expect(resolveApiUrl('journal/x.md', 'x.attachments/a.pdf')).toBe('/api/files/journal/x.md/a.pdf')
  })
})
