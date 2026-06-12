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
  it('percent-decodes the filename segment', () => {
    expect(attachmentFilename('welcome.attachments/Shot%201.png')).toBe('Shot 1.png')
    expect(attachmentFilename('welcome.attachments/Screenshot%202026-06-12%20at%2010.00.00.png')).toBe(
      'Screenshot 2026-06-12 at 10.00.00.png',
    )
  })
  it('returns the raw segment on malformed percent-encoding', () => {
    // lone '%' is not valid percent-encoding; must not throw
    expect(attachmentFilename('100%.png')).toBe('100%.png')
  })
})

describe('attachmentMarkdownPath', () => {
  it('builds the sibling-relative portable path', () => {
    expect(attachmentMarkdownPath('welcome.md', 'photo.png')).toBe('welcome.attachments/photo.png')
    expect(attachmentMarkdownPath('journal/2026-06-11.md', 'a.pdf')).toBe('2026-06-11.attachments/a.pdf')
  })
  it('percent-encodes filenames with spaces or special chars', () => {
    expect(attachmentMarkdownPath('welcome.md', 'Shot 1.png')).toBe('welcome.attachments/Shot%201.png')
    expect(attachmentMarkdownPath('welcome.md', 'Screenshot 2026-06-12 at 10.00.00.png')).toBe(
      'welcome.attachments/Screenshot%202026-06-12%20at%2010.00.00.png',
    )
  })
  it('leaves names without special chars unchanged', () => {
    expect(attachmentMarkdownPath('welcome.md', 'photo.png')).toBe('welcome.attachments/photo.png')
  })
})

describe('resolveApiUrl', () => {
  it('builds /api/files URLs from both path forms', () => {
    expect(resolveApiUrl('welcome.md', 'welcome.attachments/photo.png')).toBe('/api/files/welcome.md/photo.png')
    expect(resolveApiUrl('welcome.md', 'photo.png')).toBe('/api/files/welcome.md/photo.png')
    expect(resolveApiUrl('journal/x.md', 'x.attachments/a.pdf')).toBe('/api/files/journal/x.md/a.pdf')
  })
  it('emits a percent-encoded URL segment for filenames with spaces', () => {
    // src already encoded (from markdown storage)
    expect(resolveApiUrl('welcome.md', 'welcome.attachments/Shot%201.png')).toBe(
      '/api/files/welcome.md/Shot%201.png',
    )
    // src is the raw on-disk name (e.g. passed directly from upload)
    expect(resolveApiUrl('welcome.md', 'Shot 1.png')).toBe('/api/files/welcome.md/Shot%201.png')
  })
})
