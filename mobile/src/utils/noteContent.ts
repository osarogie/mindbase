export function extractTitle(content: string, fallback = 'Untitled'): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
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
