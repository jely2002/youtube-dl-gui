export function firstSentence(text: string): string {
  if (!text) return '';
  const match = text.match(/^(.*?[.!?])(\s|$)/);
  return match ? match[1].trim() : text.trim();
}
