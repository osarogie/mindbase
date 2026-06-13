import { describe, expect, it } from 'vitest'
import { readingTimeMinutes } from './textStats'

describe('readingTimeMinutes', () => {
  it('returns 0 for empty documents', () => expect(readingTimeMinutes(0)).toBe(0))
  it('rounds up at 225 wpm with a 1-minute floor', () => {
    expect(readingTimeMinutes(1)).toBe(1)
    expect(readingTimeMinutes(225)).toBe(1)
    expect(readingTimeMinutes(226)).toBe(2)
    expect(readingTimeMinutes(1496)).toBe(7)
  })
})
