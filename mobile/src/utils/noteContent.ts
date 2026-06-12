export function titleFromPath(path: string, fallback = 'Untitled'): string {
  const base = path.split('/').pop() ?? path;
  const stem = base.replace(/\.md$/i, '').replace(/\.csv$/i, '');
  return stem || fallback;
}

export function extractTitle(content: string, fallback = 'Untitled'): string {
  const trimmed = content.replace(/^\uFEFF/, '').trimStart();

  if (trimmed.startsWith('---')) {
    const end = trimmed.indexOf('\n---', 3);
    if (end >= 0) {
      const block = trimmed.slice(3, end);
      const titleLine = block.match(/^title:\s*["']?([^"'\n]+?)["']?\s*$/m);
      if (titleLine?.[1]?.trim()) return titleLine[1].trim();
    }
  }

  const h1 = trimmed.match(/^#\s+(.+)$/m);
  if (h1?.[1]?.trim()) return h1[1].trim();

  const heading = trimmed.match(/^#{1,6}\s+(.+)$/m);
  if (heading?.[1]?.trim()) return heading[1].trim();

  return fallback;
}

export function resolveNoteTitle(path: string, title?: string, content?: string): string {
  const fallback = titleFromPath(path);
  if (content) {
    const fromContent = extractTitle(content, '');
    if (fromContent) return fromContent;
  }
  const trimmed = title?.trim();
  if (trimmed && trimmed !== fallback) return trimmed;
  if (trimmed) return trimmed;
  return fallback;
}

export function setTitleInContent(content: string, title: string): string {
  const trimmed = title.trim() || 'Untitled';
  if (/^#\s+/m.test(content)) {
    return content.replace(/^#\s+.*$/m, `# ${trimmed}`);
  }
  return `# ${trimmed}\n\n${content}`;
}

export function insertMarkdown(content: string, snippet: string): string {
  return content ? `${content}\n${snippet}` : snippet;
}

export function newPagePath(): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `page-${stamp}.md`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatModified(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatHistoryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Wrap selection or append inline markdown markers. */
export function wrapMarkdown(content: string, before: string, after: string, placeholder: string): string {
  return content ? `${content}\n${before}${placeholder}${after}` : `${before}${placeholder}${after}`;
}
