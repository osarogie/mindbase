import { describe, expect, it } from 'vitest'
import { slashCommandsFor } from './slashCommands'

describe('slash commands', () => {
  it('image and attachment commands open the picker instead of inserting text', () => {
    const cmds = slashCommandsFor('note')
    const image = cmds.find((c) => c.id === 'image')
    const attachment = cmds.find((c) => c.id === 'attachment')
    expect(image?.picker).toBe(true)
    expect(image?.insert).toBeUndefined()
    expect(attachment?.picker).toBe(true)
  })
})
