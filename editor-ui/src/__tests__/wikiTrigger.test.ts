import { describe, expect, it } from 'vitest'
import { wikiTriggerFn } from '../plugins/WikiLinkTypeaheadPlugin'

describe('wikiTriggerFn', () => {
  it('matches an open [[ with no query', () => {
    const m = wikiTriggerFn('see [[')
    expect(m).not.toBeNull()
    expect(m?.matchingString).toBe('')
    expect(m?.replaceableString).toBe('[[')
    expect(m?.leadOffset).toBe(4)
  })

  it('captures the in-progress query', () => {
    const m = wikiTriggerFn('link to [[proj/idea')
    expect(m?.matchingString).toBe('proj/idea')
    expect(m?.replaceableString).toBe('[[proj/idea')
  })

  it('does not match once the link is closed', () => {
    expect(wikiTriggerFn('[[done]]')).toBeNull()
  })

  it('does not match a single bracket or plain text', () => {
    expect(wikiTriggerFn('[single')).toBeNull()
    expect(wikiTriggerFn('no brackets here')).toBeNull()
  })

  it('stops the query at a pipe (alias separator)', () => {
    expect(wikiTriggerFn('[[target|al')).toBeNull()
  })
})
