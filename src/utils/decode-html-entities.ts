export function decodeHtmlEntities(value: string): string {
  if (!value) return '';
  // Browser path: DOMParser is available and supports HTML documents with a body
  if (typeof DOMParser !== 'undefined') {
    try {
      const parsedDocument = new DOMParser().parseFromString(value, 'text/html');
      if (parsedDocument && parsedDocument.body && parsedDocument.body.textContent !== undefined) {
        return parsedDocument.body.textContent ?? '';
      }
    } catch {
      // Fallback to replacement rules below
    }
  }
  // Bun/Node test path: handle the common HTML entities WordPress.org uses
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&apos;/g, "'");
}
