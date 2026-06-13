/** Count visible words; whitespace never contributes to the total. */
export function countWords(text: string): number {
  const normalized = text.replace(/\u00A0/g, ' ').trim()
  if (!normalized) return 0
  const matches = normalized.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)
  return matches?.length ?? 0
}

export function countStats(text: string) {
  const normalized = text.replace(/\u00A0/g, ' ').trim()
  if (!normalized) return { words: 0, chars: 0 }
  return {
    words: countWords(normalized),
    chars: normalized.length,
  }
}

/** Reading time at 225 wpm: 0 for empty docs, otherwise ceil with a 1-minute floor. */
export function readingTimeMinutes(words: number): number {
  if (words <= 0) return 0
  return Math.max(1, Math.ceil(words / 225))
}
