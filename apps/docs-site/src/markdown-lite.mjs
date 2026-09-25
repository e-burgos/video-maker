import { escapeHtml } from './render.mjs';

function autolinkBareUrls(html) {
  return html.replace(/(?<!href="|>)(https?:\/\/[^\s()<]+[^\s()<.,;:])/g, '<a href="$1">$1</a>');
}

function renderInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = autolinkBareUrls(html);
  return html;
}

function flushParagraph(lines, out) {
  if (lines.length === 0) {
    return;
  }
  out.push(`<p>${renderInline(lines.join(' '))}</p>`);
  lines.length = 0;
}

function flushList(items, out) {
  if (items.length === 0) {
    return;
  }
  out.push(`<ul class="plain">${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`);
  items.length = 0;
}

export function renderMarkdownLite(markdown) {
  const out = [];
  const paragraphLines = [];
  const listItems = [];

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trimEnd();
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    const listMatch = /^-\s+(.*)$/.exec(line);

    if (headingMatch !== null) {
      flushParagraph(paragraphLines, out);
      flushList(listItems, out);
      const level = Math.min(headingMatch[1].length + 1, 6);
      out.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (listMatch !== null) {
      flushParagraph(paragraphLines, out);
      listItems.push(listMatch[1]);
      continue;
    }

    if (line === '') {
      flushParagraph(paragraphLines, out);
      flushList(listItems, out);
      continue;
    }

    if (listItems.length > 0) {
      listItems[listItems.length - 1] += ` ${line.trim()}`;
      continue;
    }

    paragraphLines.push(line.trim());
  }

  flushParagraph(paragraphLines, out);
  flushList(listItems, out);

  return out.join('\n');
}
