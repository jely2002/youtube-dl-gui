const urlRegex = /\b((?:https?:\/\/|www\.)[^\s<]+[^<.,:;"')\]\s])/gi;

export function useLinkify(): { linkify: (text: string) => string } {
  function linkify(text: string): string {
    urlRegex.lastIndex = 0;
    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = urlRegex.exec(text)) !== null) {
      const urlText = match[0];
      const start = match.index;
      const end = start + urlText.length;

      const before = text.slice(lastIndex, start);
      result += escapeHtml(before);

      let href = urlText;
      if (!/^https?:\/\//i.test(href)) {
        href = 'https://' + href;
      }

      const safeHref = escapeHtml(href);
      const escapedLabel = escapeHtml(urlText);
      result += `<a class="link" target="_blank" rel="noopener noreferrer" href="${safeHref}">${escapedLabel}</a>`;

      lastIndex = end;
    }

    const tail = text.slice(lastIndex);
    result += escapeHtml(tail);
    return result;
  }

  return { linkify };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
