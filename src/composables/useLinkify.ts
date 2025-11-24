const urlRegex = /\b((?:https?:\/\/|www\.)[^\s<]+[^<.,:;"')\]\s])/gi;

export function useLinkify() {
  function linkify(text: string): string {
    let result = '';
    let lastIndex = 0;

    for (;;) {
      const match = urlRegex.exec(text);
      if (!match) break;

      const urlText = match[0];
      const start = match.index;
      const end = start + urlText.length;

      const before = text.slice(lastIndex, start);
      result += escapeHtml(before);

      let href = urlText;
      if (!/^https?:\/\//i.test(href)) {
        href = 'https://' + href;
      }
      const escapedLabel = escapeHtml(urlText);
      result += `<a class="link" target="_blank" rel="noopener noreferrer" href="${href}">${escapedLabel}</a>`;

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
