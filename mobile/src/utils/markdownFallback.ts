/** JS fallback markdown ↔ HTML — mirrors internal/markdown/render.go for mobile offline use. */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, '').trim());
}

function inlineMarkdownToHtml(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

function inlineHtmlToMarkdown(text: string): string {
  let out = text;
  out = out.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  out = out.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  out = out.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  out = out.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  return stripTags(out);
}

export function markdownToEditorHtml(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const parts: string[] = [];
  let inCode = false;
  let inList = false;
  let listIsTask = false;
  let codeLines: string[] = [];
  let codeLang = '';

  const closeList = () => {
    if (inList) {
      parts.push('</ul>');
      inList = false;
      listIsTask = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (!inCode) {
        closeList();
        inCode = true;
        codeLang = trimmed.slice(3).trim();
        codeLines = [];
      } else {
        const code = escapeHtml(codeLines.join('\n'));
        const langClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : '';
        parts.push(`<pre><code${langClass}>${code}</code></pre>`);
        inCode = false;
        codeLang = '';
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const taskMatch = /^[-*+]\s+\[([ xX])\]\s+(.+)$/.exec(trimmed);
    if (taskMatch) {
      if (!inList || !listIsTask) {
        closeList();
        parts.push('<ul class="task-list">');
        inList = true;
        listIsTask = true;
      }
      const checked = taskMatch[1].toLowerCase() === 'x' ? ' checked' : '';
      parts.push(
        `<li class="task-item"><input type="checkbox" disabled${checked}/> ${inlineMarkdownToHtml(taskMatch[2])}</li>`,
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      closeList();
      parts.push(`<h1>${inlineMarkdownToHtml(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith('## ')) {
      closeList();
      parts.push(`<h2>${inlineMarkdownToHtml(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith('### ')) {
      closeList();
      parts.push(`<h3>${inlineMarkdownToHtml(trimmed.slice(4))}</h3>`);
    } else if (/^[-*+]\s+/.test(trimmed)) {
      if (inList && listIsTask) closeList();
      if (!inList) {
        parts.push('<ul>');
        inList = true;
      }
      parts.push(`<li>${inlineMarkdownToHtml(trimmed.replace(/^[-*+]\s+/, ''))}</li>`);
    } else if (trimmed.startsWith('> ')) {
      closeList();
      parts.push(`<blockquote>${inlineMarkdownToHtml(trimmed.slice(2))}</blockquote>`);
    } else if (trimmed === '') {
      closeList();
      parts.push('<br/>');
    } else {
      closeList();
      parts.push(`<p>${inlineMarkdownToHtml(trimmed)}</p>`);
    }
  }

  closeList();
  if (inCode && codeLines.length) {
    parts.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }

  return parts.join('\n') || '<p><br/></p>';
}

export function editorHtmlToMarkdown(html: string): string {
  let source = html.replace(/\r\n/g, '\n').trim();
  if (!source) return '';

  const blocks: string[] = [];

  source = source.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
    const key = `MBBLOCK${blocks.length}`;
    blocks.push(`\`\`\`\n${stripTags(code)}\n\`\`\``);
    return key;
  });

  source = source.replace(
    /<ul[^>]*class="[^"]*task-list[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi,
    (_, inner) => {
      const lines = inner.replace(
        /<li[^>]*class="[^"]*task-item[^"]*"[^>]*>[\s\S]*?<input[^>]*?(checked)?[^>]*\/?>\s*([\s\S]*?)<\/li>/gi,
        (_m: string, checked: string | undefined, text: string) =>
          `- [${checked ? 'x' : ' '}] ${inlineHtmlToMarkdown(text)}\n`,
      );
      return `${lines.trim()}\n\n`;
    },
  );

  source = source.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, text) => `# ${inlineHtmlToMarkdown(text)}\n\n`);
  source = source.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, text) => `## ${inlineHtmlToMarkdown(text)}\n\n`);
  source = source.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, text) => `### ${inlineHtmlToMarkdown(text)}\n\n`);
  source = source.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, text) => {
    const line = inlineHtmlToMarkdown(text);
    return `> ${line}\n\n`;
  });

  source = source.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    const lines = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, text: string) => {
      return `- ${inlineHtmlToMarkdown(text)}\n`;
    });
    return `${lines.trim()}\n\n`;
  });

  source = source.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    let index = 0;
    const lines = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, text: string) => {
      index += 1;
      return `${index}. ${inlineHtmlToMarkdown(text)}\n`;
    });
    return `${lines.trim()}\n\n`;
  });

  source = source.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, text) => {
    const line = inlineHtmlToMarkdown(text);
    return line ? `${line}\n\n` : '\n';
  });

  source = source.replace(/<br\s*\/?>/gi, '\n');
  source = source.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, (_, text) => `${inlineHtmlToMarkdown(text)}\n\n`);
  source = source.replace(/<[^>]+>/g, '');
  source = decodeEntities(source);

  for (let i = 0; i < blocks.length; i += 1) {
    source = source.replace(`MBBLOCK${i}`, blocks[i]!);
  }

  return source.replace(/\n{3,}/g, '\n\n').trim();
}
