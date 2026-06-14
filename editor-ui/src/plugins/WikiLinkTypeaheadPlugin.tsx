import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuTextMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin'
import { $createTextNode, $getSelection, $isRangeSelection, type TextNode } from 'lexical'
import { $createWikiLinkNode } from '../nodes/mindbaseTokenNodes'
import { useLinkSource, type LinkSuggestion } from '../links/host'

// Match "[[" followed by the in-progress query (no closing brackets / pipe yet),
// anchored to the caret. Two-char triggers need a custom matcher; the basic
// typeahead trigger only handles a single character.
const WIKI_TRIGGER = /\[\[([^[\]|]*)$/

export function wikiTriggerFn(text: string): MenuTextMatch | null {
  const match = WIKI_TRIGGER.exec(text)
  if (match === null) return null
  return {
    leadOffset: match.index,
    matchingString: match[1],
    replaceableString: match[0],
  }
}

class WikiOption extends MenuOption {
  suggestion: LinkSuggestion
  /** A synthetic option that creates a brand-new link from the typed query. */
  isNew: boolean

  constructor(suggestion: LinkSuggestion, isNew = false) {
    super(`${isNew ? 'new:' : ''}${suggestion.target}`)
    this.suggestion = suggestion
    this.isNew = isNew
  }
}

function WikiMenu({
  options,
  selectedIndex,
  setHighlightedIndex,
  selectOptionAndCleanUp,
}: {
  options: WikiOption[]
  selectedIndex: number | null
  setHighlightedIndex: (index: number) => void
  selectOptionAndCleanUp: (option: WikiOption) => void
}) {
  return (
    <div className="mb-slash-menu mb-wiki-menu" role="listbox">
      {options.map((option, index) => (
        <button
          key={option.key}
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
          <span className="mb-slash-body">
            <span className="mb-slash-label">
              {option.isNew ? `Create “${option.suggestion.label}”` : option.suggestion.label}
            </span>
            <span className="mb-slash-hint">{option.suggestion.target}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/** `[[` autocomplete: pick an existing note (or create a new link) to reference. */
export function WikiLinkTypeaheadPlugin() {
  const [editor] = useLexicalComposerContext()
  const linkSource = useLinkSource()
  const [query, setQuery] = useState<string | null>(null)
  const [items, setItems] = useState<LinkSuggestion[]>([])

  // (Re)load candidates each time the menu opens, so freshly created notes show up.
  const wasOpen = useRef(false)
  useEffect(() => {
    const open = query !== null
    if (open && !wasOpen.current && linkSource) {
      Promise.resolve(linkSource())
        .then(setItems)
        .catch(() => setItems([]))
    }
    wasOpen.current = open
  }, [query, linkSource])

  const options = useMemo(() => {
    const q = (query ?? '').trim().toLowerCase()
    const matched = items
      .filter((i) => !q || i.label.toLowerCase().includes(q) || i.target.toLowerCase().includes(q))
      .slice(0, 8)
      .map((i) => new WikiOption(i))
    // Offer to create a new link when the query doesn't exactly match a target.
    if (q && !items.some((i) => i.target.toLowerCase() === q || i.label.toLowerCase() === q)) {
      matched.push(new WikiOption({ target: query!.trim(), label: query!.trim() }, true))
    }
    return matched
  }, [items, query])

  const onSelectOption = useCallback(
    (option: WikiOption, _textNode: TextNode | null, closeMenu: () => void, matchingString: string) => {
      editor.update(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return
        // Remove the typed "[[query" backward from the caret (robust across splits).
        const token = `[[${matchingString}`
        for (let i = 0; i < token.length; i++) selection.deleteCharacter(true)
        const node = $createWikiLinkNode(option.suggestion.target, option.suggestion.label)
        selection.insertNodes([node, $createTextNode(' ')])
      })
      closeMenu()
    },
    [editor],
  )

  if (!linkSource) return null

  return (
    <LexicalTypeaheadMenuPlugin<WikiOption>
      onQueryChange={setQuery}
      triggerFn={wikiTriggerFn}
      options={options}
      onSelectOption={onSelectOption}
      menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
        if (!anchorElementRef.current || options.length === 0) return null
        return createPortal(
          <WikiMenu
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
