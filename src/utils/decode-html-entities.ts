export function decodeHtmlEntities(value: string): string {
  // Browser path: DOMParser is available
  if (typeof DOMParser !== 'undefined') {
    const parsedDocument = new DOMParser().parseFromString(value, 'text/html');
    return parsedDocument.body.textContent ?? '';
  }
  // Bun/Node test path: handle the common HTML entities WordPress.org uses
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}
