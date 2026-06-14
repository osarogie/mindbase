import { createContext, useContext } from 'react'

/** One candidate for the `[[` link picker. */
export interface LinkSuggestion {
  /** Wiki-link target written into `[[target]]` (e.g. "projects/idea"). */
  target: string
  /** Human label shown in the menu and as the link text. */
  label: string
}

/** Supplies the candidate notes for the `[[` autocomplete. Host-provided. */
export type LinkSource = () => Promise<LinkSuggestion[]> | LinkSuggestion[]

export const LinkSourceContext = createContext<LinkSource | null>(null)

export function useLinkSource(): LinkSource | null {
  return useContext(LinkSourceContext)
}
