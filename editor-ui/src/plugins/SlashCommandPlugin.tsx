import { createPortal } from 'react-dom'
import { useCallback, useMemo, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin'
import type { TextNode } from 'lexical'
import { runSlashCommand } from '../editorCommands'
import { OPEN_ATTACHMENT_PICKER_COMMAND } from './AttachmentPickerPlugin'
import { filterSlashCommands, slashCommandsFor, type SlashCommand, type SlashDocumentKind } from '../slashCommands'

class SlashMenuOption extends MenuOption {
  command: SlashCommand

  constructor(command: SlashCommand) {
    super(command.label)
    this.command = command
  }
}

function SlashMenu({
  options,
  selectedIndex,
  setHighlightedIndex,
  selectOptionAndCleanUp,
}: {
  options: SlashMenuOption[]
  selectedIndex: number | null
  setHighlightedIndex: (index: number) => void
  selectOptionAndCleanUp: (option: SlashMenuOption) => void
}) {
  if (options.length === 0) {
    return (
      <div className="mb-slash-menu">
        <div className="mb-slash-empty">No matching commands</div>
      </div>
    )
  }

  return (
    <div className="mb-slash-menu" role="listbox">
      {options.map((option, index) => (
        <button
          key={option.command.id}
          type="button"
          role="option"
          aria-selected={selectedIndex === index}
          className={`mb-slash-item${selectedIndex === index ? ' mb-slash-item-active' : ''}`}
          onMouseEnter={() => setHighlightedIndex(index)}
          onMouseDown={(e) => {
            e.preventDefault()
            selectOptionAndCleanUp(option)
          }}
        >
          <span className="mb-slash-icon">{option.command.icon}</span>
          <span className="mb-slash-body">
            <span className="mb-slash-label">{option.command.label}</span>
            <span className="mb-slash-hint">{option.command.hint}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

interface Props {
  documentKind?: SlashDocumentKind
}

export function SlashCommandPlugin({ documentKind = 'note' }: Props) {
  const [editor] = useLexicalComposerContext()
  const [query, setQuery] = useState<string | null>(null)
  const triggerFn = useBasicTypeaheadTriggerMatch('/', { minLength: 0, maxLength: 24 })

  const baseCommands = useMemo(() => slashCommandsFor(documentKind), [documentKind])

  const options = useMemo(() => {
    const filtered = filterSlashCommands(baseCommands, query ?? '')
    return filtered.map((command) => new SlashMenuOption(command))
  }, [baseCommands, query])

  const onSelectOption = useCallback(
    (
      selectedOption: SlashMenuOption,
      textNodeContainingQuery: TextNode | null,
      closeMenu: () => void,
      matchingString: string,
    ) => {
      editor.update(() => {
        if (textNodeContainingQuery) {
          const text = textNodeContainingQuery.getTextContent()
          const token = `/${matchingString}`
          const idx = text.lastIndexOf(token)
          if (idx >= 0) {
            const before = text.slice(0, idx)
            if (before) textNodeContainingQuery.setTextContent(before)
            else textNodeContainingQuery.remove()
          } else {
            textNodeContainingQuery.remove()
          }
        }
      })
      if (selectedOption.command.picker) {
        editor.dispatchCommand(OPEN_ATTACHMENT_PICKER_COMMAND, undefined)
      } else {
        runSlashCommand(editor, selectedOption.command)
      }
      closeMenu()
    },
    [editor],
  )

  return (
    <LexicalTypeaheadMenuPlugin<SlashMenuOption>
      onQueryChange={setQuery}
      triggerFn={triggerFn}
      options={options}
      onSelectOption={onSelectOption}
      menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
        if (!anchorElementRef.current || options.length === 0) return null
        return createPortal(
          <SlashMenu
            options={options}
            selectedIndex={selectedIndex}
            setHighlightedIndex={setHighlightedIndex}
            selectOptionAndCleanUp={selectOptionAndCleanUp}
          />,
          anchorElementRef.current,
        )
      }}
    />
  )
}
