export function normalizeGrid(headers: string[], rows: string[][]) {
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length), 1)
  const h = Array.from({ length: colCount }, (_, i) => headers[i] ?? `col_${i + 1}`)
  const r = rows.map((row) => Array.from({ length: colCount }, (_, i) => row[i] ?? ''))
  return { headers: h, rows: r }
}

export function tableToMarkdown(title: string, headers: string[], rows: string[][]) {
  const { headers: h, rows: r } = normalizeGrid(headers, rows)
  if (h.length === 0) return `# ${title}\n\n`
  const esc = (c: string) => c.replace(/\|/g, '\\|')
  const lines = [
    `# ${title}`,
    '',
    `| ${h.map(esc).join(' | ')} |`,
    `| ${h.map(() => '---').join(' | ')} |`,
    ...r.map((row) => `| ${row.map(esc).join(' | ')} |`),
  ]
  return lines.join('\n')
}

/** Parse TSV/CSV clipboard data (Excel, Google Sheets, etc.) */
export function parseClipboardGrid(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  if (lines.length === 0) return []
  const delimiter = lines.some((l) => l.includes('\t')) ? '\t' : ','
  return lines.map((line) => {
    if (delimiter === '\t') return line.split('\t').map((c) => c.trim())
    return parseCsvLine(line)
  })
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}
