export function decodeHtmlEntities(value: string): string {
  const parsedDocument = new DOMParser().parseFromString(value, 'text/html');

  return parsedDocument.body.textContent ?? '';
}
