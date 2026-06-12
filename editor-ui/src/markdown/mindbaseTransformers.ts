import type { TextMatchTransformer } from '@lexical/markdown'
import { TRANSFORMERS } from '@lexical/markdown'
import { ATTACHMENT_EMBED } from './attachmentTransformer'
import {
  $createMentionNode,
  $createScheduleNode,
  $createTagNode,
  $createWikiLinkNode,
  $isMentionNode,
  $isScheduleNode,
  $isTagNode,
  $isWikiLinkNode,
  MentionNode,
  ScheduleNode,
  TagNode,
  WikiLinkNode,
} from '../nodes/mindbaseTokenNodes'

const WIKI_IMPORT = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/
const WIKI_TYPED = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/

export const WIKI_LINK: TextMatchTransformer = {
  dependencies: [WikiLinkNode],
  export: (node) => {
    if (!$isWikiLinkNode(node)) return null
    const target = node.getTarget()
    const label = node.getLabel()
    if (label && label !== target) return `[[${target}|${label}]]`
    return `[[${target}]]`
  },
  importRegExp: WIKI_IMPORT,
  regExp: WIKI_TYPED,
  replace: (textNode, match) => {
    const target = match[1]
    const label = match[2]?.trim() || target
    textNode.replace($createWikiLinkNode(target, label))
  },
  trigger: ']',
  type: 'text-match',
}

const TAG_IMPORT = /#([a-zA-Z][\w/-]*)/
const TAG_TYPED = /(?:^|\s)(#([a-zA-Z][\w/-]*))$/

export const TAG: TextMatchTransformer = {
  dependencies: [TagNode],
  export: (node) => {
    if (!$isTagNode(node)) return null
    return `#${node.getTag()}`
  },
  importRegExp: TAG_IMPORT,
  regExp: TAG_TYPED,
  replace: (textNode, match) => {
    const tag = match[2] ?? match[1]
    const node = $createTagNode(tag)
    const lead = match[0].startsWith(' ') ? ' ' : ''
    if (lead) {
      textNode.setTextContent(lead)
      textNode.insertAfter(node)
      return
    }
    textNode.replace(node)
  },
  trigger: ' ',
  type: 'text-match',
}

const MENTION_IMPORT = /@([a-zA-Z][\w/-]*)/
const MENTION_TYPED = /(?:^|\s)(@([a-zA-Z][\w/-]*))$/

export const MENTION: TextMatchTransformer = {
  dependencies: [MentionNode],
  export: (node) => {
    if (!$isMentionNode(node)) return null
    return `@${node.getName()}`
  },
  importRegExp: MENTION_IMPORT,
  regExp: MENTION_TYPED,
  replace: (textNode, match) => {
    const name = match[2] ?? match[1]
    const node = $createMentionNode(name)
    const lead = match[0].startsWith(' ') ? ' ' : ''
    if (lead) {
      textNode.setTextContent(lead)
      textNode.insertAfter(node)
      return
    }
    textNode.replace(node)
  },
  trigger: ' ',
  type: 'text-match',
}

const SCHEDULE_IMPORT = />(today|tomorrow|yesterday|\d{4}-\d{2}-\d{2})/i
const SCHEDULE_TYPED = /(?:^|\s)(>(today|tomorrow|yesterday|\d{4}-\d{2}-\d{2}))$/i

export const SCHEDULE: TextMatchTransformer = {
  dependencies: [ScheduleNode],
  export: (node) => {
    if (!$isScheduleNode(node)) return null
    return `>${node.getWhen()}`
  },
  importRegExp: SCHEDULE_IMPORT,
  regExp: SCHEDULE_TYPED,
  replace: (textNode, match) => {
    const when = (match[2] ?? match[1]).toLowerCase()
    const node = $createScheduleNode(when)
    const lead = match[0].startsWith(' ') ? ' ' : ''
    if (lead) {
      textNode.setTextContent(lead)
      textNode.insertAfter(node)
      return
    }
    textNode.replace(node)
  },
  trigger: ' ',
  type: 'text-match',
}

/** Standard GFM + Mindbase wiki links, tags, mentions, schedules. */
export const MINDBASE_TRANSFORMERS = [ATTACHMENT_EMBED, ...TRANSFORMERS, WIKI_LINK, TAG, MENTION, SCHEDULE]
