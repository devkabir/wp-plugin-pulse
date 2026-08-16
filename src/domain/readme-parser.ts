import type {
  ParsedField,
  ParsedReadme,
  ParsedSection,
  ParsedSubsection,
  ParseDiagnostic,
  ReadmeParserOptions,
  SourceRange,
} from './readme-types.ts';

export const DEFAULT_MAX_README_SIZE = 1024 * 1024; // 1 MB

interface LineInfo {
  index: number;
  lineNumber: number;
  start: number;
  end: number;
  lineEnd: number;
  raw: string;
  delimiter: string;
  isEmpty: boolean;
}

const KNOWN_HEADER_CANONICAL: Record<string, string> = {
  contributors: 'Contributors',
  'donate link': 'Donate link',
  tags: 'Tags',
  'requires at least': 'Requires at least',
  'tested up to': 'Tested up to',
  'requires php': 'Requires PHP',
  'stable tag': 'Stable tag',
  license: 'License',
  'license uri': 'License URI',
  'requires plugins': 'Requires Plugins',
  'wc requires at least': 'WC requires at least',
  'wc tested up to': 'WC tested up to',
};

/**
 * Creates a case-insensitive lookup proxy for header records.
 */
export function createCaseInsensitiveHeaders<T extends SourceRange>(
  rawMap: Record<string, T>
): Record<string, T> {
  const normalizedMap = new Map<string, T>();
  for (const [key, val] of Object.entries(rawMap)) {
    normalizedMap.set(key.toLowerCase().trim(), val);
  }

  return new Proxy(rawMap, {
    get(target, prop, receiver) {
      if (typeof prop === 'string') {
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }
        const lower = prop.toLowerCase().trim();
        const found = normalizedMap.get(lower);
        if (found !== undefined) {
          return found;
        }
      }
      return Reflect.get(target, prop, receiver);
    },
    has(target, prop) {
      if (typeof prop === 'string') {
        if (prop in target) return true;
        return normalizedMap.has(prop.toLowerCase().trim());
      }
      return Reflect.has(target, prop);
    },
    set(target, prop, value, receiver) {
      if (typeof prop === 'string') {
        normalizedMap.set(prop.toLowerCase().trim(), value as T);
      }
      return Reflect.set(target, prop, value, receiver);
    },
  });
}

/**
 * Splits raw source into indexed line tokens with exact start/end offsets.
 */
function scanLines(source: string): LineInfo[] {
  const lines: LineInfo[] = [];
  const lineRegex = /([^\r\n]*)(\r\n|\r|\n|$)/g;
  let match: RegExpExecArray | null;
  let lineIdx = 0;

  while ((match = lineRegex.exec(source)) !== null) {
    if (match.index === source.length && lines.length > 0) {
      break;
    }

    const raw = match[1];
    const delimiter = match[2];
    const start = match.index;
    const end = start + raw.length;
    const lineEnd = end + delimiter.length;

    lines.push({
      index: lineIdx,
      lineNumber: lineIdx + 1,
      start,
      end,
      lineEnd,
      raw,
      delimiter,
      isEmpty: raw.trim().length === 0,
    });

    lineIdx++;
    if (lineEnd === source.length && delimiter === '') {
      break;
    }
  }

  return lines;
}

/**
 * Parses a WordPress readme.txt file.
 */
export function parseReadme(
  source: string,
  options: ReadmeParserOptions = {}
): ParsedReadme {
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_README_SIZE;
  const diagnostics: ParseDiagnostic[] = [];

  if (source.length > maxSizeBytes) {
    diagnostics.push({
      code: 'FILE_TOO_LARGE',
      message: `File size (${source.length} bytes) exceeds maximum limit of ${maxSizeBytes} bytes.`,
      severity: 'error',
      range: { start: 0, end: source.length },
      line: 1,
    });
    return {
      source,
      title: null,
      headers: createCaseInsensitiveHeaders({}),
      shortDescription: null,
      sections: [],
      diagnostics,
    };
  }

  const lines = scanLines(source);
  if (lines.length === 0 || lines.every((l) => l.isEmpty)) {
    diagnostics.push({
      code: 'EMPTY_FILE',
      message: 'Readme file is empty.',
      severity: 'error',
      line: 1,
    });
    return {
      source,
      title: null,
      headers: createCaseInsensitiveHeaders({}),
      shortDescription: null,
      sections: [],
      diagnostics,
    };
  }

  let linePointer = 0;

  // 1. Skip leading empty lines before title
  while (linePointer < lines.length && lines[linePointer].isEmpty) {
    linePointer++;
  }

  // 2. Parse Plugin Title
  let titleRange: SourceRange | null = null;
  if (linePointer < lines.length) {
    const line = lines[linePointer];
    const trimmed = line.raw.trim();
    const titleMatch = trimmed.match(/^===\s*(.+?)\s*===$/);

    if (titleMatch) {
      const cleanTitle = titleMatch[1].trim();
      if (!cleanTitle) {
        diagnostics.push({
          code: 'MALFORMED_TITLE',
          message: 'Plugin title cannot be empty inside "=== ... ===".',
          severity: 'error',
          range: { start: line.start, end: line.end },
          line: line.lineNumber,
        });
      }
      titleRange = {
        start: line.start,
        end: line.end,
        raw: line.raw,
        value: cleanTitle,
        line: line.lineNumber,
      };
      linePointer++;
    } else if (trimmed.startsWith('===') || trimmed.endsWith('===')) {
      diagnostics.push({
        code: 'MALFORMED_TITLE',
        message: 'Plugin title is malformed; expected format "=== Plugin Name ===".',
        severity: 'error',
        range: { start: line.start, end: line.end },
        line: line.lineNumber,
      });
      const partial = trimmed.replace(/^===+/, '').replace(/===+$/, '').trim();
      titleRange = {
        start: line.start,
        end: line.end,
        raw: line.raw,
        value: partial,
        line: line.lineNumber,
      };
      linePointer++;
    } else {
      diagnostics.push({
        code: 'MISSING_TITLE',
        message: 'Missing plugin title; readme.txt should begin with "=== Plugin Name ===".',
        severity: 'error',
        range: { start: line.start, end: line.end },
        line: line.lineNumber,
      });
    }
  }

  // Check blank line after title if followed by headers
  if (titleRange && linePointer < lines.length && !lines[linePointer].isEmpty) {
    // If next line is a header or content without blank line
    const nextTrimmed = lines[linePointer].raw.trim();
    if (!nextTrimmed.startsWith('==')) {
      // It's acceptable for headers to directly follow title in some WP readmes,
      // but if short description directly follows title without headers or blank line, flag it.
      if (!nextTrimmed.includes(':')) {
        diagnostics.push({
          code: 'MISSING_BLANK_LINE',
          message: 'Missing blank line after plugin title.',
          severity: 'warning',
          range: { start: lines[linePointer].start, end: lines[linePointer].end },
          line: lines[linePointer].lineNumber,
        });
      }
    }
  }

  // 3. Parse Headers
  const rawHeaders: Record<string, ParsedField> = {};
  const seenHeaderKeys = new Set<string>();

  // Skip blank lines after title before headers
  while (linePointer < lines.length && lines[linePointer].isEmpty) {
    linePointer++;
  }

  let reachedContent = false;
  while (linePointer < lines.length && !reachedContent) {
    const line = lines[linePointer];
    const trimmed = line.raw.trim();

    if (line.isEmpty) {
      // Blank line terminates header block if we've parsed headers
      if (Object.keys(rawHeaders).length > 0) {
        linePointer++;
        break;
      }
      linePointer++;
      continue;
    }

    if (trimmed.startsWith('==')) {
      // Reached a section header
      break;
    }

    const colonIdx = line.raw.indexOf(':');
    if (colonIdx > 0) {
      const rawKeyPart = line.raw.substring(0, colonIdx);
      const rawValPart = line.raw.substring(colonIdx + 1);
      const keyName = rawKeyPart.trim();
      const value = rawValPart.trim();
      const lowerKey = keyName.toLowerCase();

      const leadingKeySpaces = rawKeyPart.length - rawKeyPart.trimStart().length;
      const keyStart = line.start + leadingKeySpaces;
      const keyEnd = keyStart + keyName.length;

      let valueStart = line.start + colonIdx + 1;
      const valLeadingSpaces = rawValPart.length - rawValPart.trimStart().length;
      valueStart += valLeadingSpaces;
      const valTrailingSpaces = rawValPart.length - rawValPart.trimEnd().length;
      const valueEnd = line.end - valTrailingSpaces;

      if (seenHeaderKeys.has(lowerKey)) {
        diagnostics.push({
          code: 'DUPLICATE_HEADER',
          message: `Duplicate header "${keyName}" found on line ${line.lineNumber}.`,
          severity: 'warning',
          range: { start: line.start, end: line.end },
          line: line.lineNumber,
        });
      }
      seenHeaderKeys.add(lowerKey);

      const canonicalKey = KNOWN_HEADER_CANONICAL[lowerKey] || keyName;

      let values: string[] | undefined = undefined;
      if (['tags', 'contributors', 'requires plugins'].includes(lowerKey)) {
        values = value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const field: ParsedField = {
        key: canonicalKey,
        rawKey: keyName,
        rawKeyRange: { start: keyStart, end: keyEnd },
        rawValueRange: { start: valueStart, end: Math.max(valueStart, valueEnd) },
        start: line.start,
        end: line.end,
        raw: line.raw,
        value,
        line: line.lineNumber,
        ...(values !== undefined ? { values } : {}),
      };

      rawHeaders[canonicalKey] = field;
      if (canonicalKey !== lowerKey) {
        rawHeaders[lowerKey] = field;
      }
      linePointer++;
    } else {
      // Line is not a header; we reached short description or content
      reachedContent = true;
      break;
    }
  }

  // 4. Parse Short Description (text before the first section `== ... ==`)
  let shortDescField: ParsedField | null = null;
  const descLines: LineInfo[] = [];

  // Check if headers were immediately followed by non-blank content
  if (
    reachedContent &&
    Object.keys(rawHeaders).length > 0 &&
    linePointer > 0 &&
    !lines[linePointer - 1].isEmpty
  ) {
    diagnostics.push({
      code: 'MISSING_BLANK_LINE',
      message: 'Missing blank line between header block and content.',
      severity: 'warning',
      range: { start: lines[linePointer].start, end: lines[linePointer].end },
      line: lines[linePointer].lineNumber,
    });
  }

  // Skip leading empty lines before short description
  while (linePointer < lines.length && lines[linePointer].isEmpty) {
    linePointer++;
  }

  while (linePointer < lines.length) {
    const line = lines[linePointer];
    const trimmed = line.raw.trim();
    if (trimmed.startsWith('==') && trimmed.endsWith('==')) {
      // Reached section
      break;
    }
    descLines.push(line);
    linePointer++;
  }

  if (descLines.length > 0) {
    // Trim trailing empty lines from short description
    while (descLines.length > 0 && descLines[descLines.length - 1].isEmpty) {
      descLines.pop();
    }

    if (descLines.length > 0) {
      const firstLine = descLines[0];
      const lastLine = descLines[descLines.length - 1];
      const rawSlice = source.slice(firstLine.start, lastLine.end);
      const value = rawSlice.trim();

      shortDescField = {
        key: 'Short Description',
        rawKey: 'Short Description',
        start: firstLine.start,
        end: lastLine.end,
        raw: rawSlice,
        value,
        line: firstLine.lineNumber,
      };

      // Check if short description touched the next section without blank line
      if (
        linePointer < lines.length &&
        lines[linePointer].raw.trim().startsWith('==') &&
        !descLines[descLines.length - 1].isEmpty &&
        (linePointer === 0 || !lines[linePointer - 1].isEmpty)
      ) {
        diagnostics.push({
          code: 'MISSING_BLANK_LINE',
          message: 'Missing blank line after short description before section.',
          severity: 'warning',
          range: { start: lines[linePointer].start, end: lines[linePointer].end },
          line: lines[linePointer].lineNumber,
        });
      }
    }
  }

  // 5. Parse Sections
  const sections: ParsedSection[] = [];
  const seenSectionTitles = new Set<string>();

  while (linePointer < lines.length) {
    const line = lines[linePointer];
    const trimmed = line.raw.trim();

    if (line.isEmpty) {
      linePointer++;
      continue;
    }

    const sectionHeaderMatch = trimmed.match(/^==\s*([^=].*?)\s*==$/);
    if (sectionHeaderMatch) {
      const cleanTitle = sectionHeaderMatch[1].trim();
      const rawTitle = sectionHeaderMatch[1];
      const lowerTitle = cleanTitle.toLowerCase();

      // Check for missing blank line before section heading
      if (linePointer > 0 && !lines[linePointer - 1].isEmpty) {
        diagnostics.push({
          code: 'MISSING_BLANK_LINE',
          message: `Missing blank line before section "== ${cleanTitle} ==" on line ${line.lineNumber}.`,
          severity: 'warning',
          range: { start: line.start, end: line.end },
          line: line.lineNumber,
        });
      }

      if (seenSectionTitles.has(lowerTitle)) {
        diagnostics.push({
          code: 'DUPLICATE_SECTION',
          message: `Duplicate section "== ${cleanTitle} ==" found on line ${line.lineNumber}.`,
          severity: 'error',
          range: { start: line.start, end: line.end },
          line: line.lineNumber,
        });
      }
      seenSectionTitles.add(lowerTitle);

      const titleRange: SourceRange = {
        start: line.start,
        end: line.end,
        raw: line.raw,
        value: cleanTitle,
        line: line.lineNumber,
      };

      const sectionStartOffset = line.start;
      linePointer++;

      const bodyLines: LineInfo[] = [];
      while (linePointer < lines.length) {
        const nextLine = lines[linePointer];
        const nextTrimmed = nextLine.raw.trim();
        if (nextTrimmed.match(/^==\s*([^=].*?)\s*==$/)) {
          break;
        }
        bodyLines.push(nextLine);
        linePointer++;
      }

      let bodyStart = line.lineEnd;
      let bodyEnd = bodyStart;
      let bodyRaw = '';
      let bodyValue = '';

      if (bodyLines.length > 0) {
        const firstBodyLine = bodyLines[0];
        const lastBodyLine = bodyLines[bodyLines.length - 1];
        bodyStart = firstBodyLine.start;
        bodyEnd = lastBodyLine.end;
        bodyRaw = source.slice(bodyStart, bodyEnd);
        bodyValue = bodyRaw.trim();
      }

      const fullSectionEnd = bodyLines.length > 0 ? bodyLines[bodyLines.length - 1].end : line.end;
      const fullSectionRaw = source.slice(sectionStartOffset, fullSectionEnd);

      const subsections = parseSubsections(bodyLines, source);

      sections.push({
        title: cleanTitle,
        rawTitle,
        titleRange,
        body: bodyValue,
        bodyRange: {
          start: bodyStart,
          end: bodyEnd,
          raw: bodyRaw,
          value: bodyValue,
        },
        range: {
          start: sectionStartOffset,
          end: fullSectionEnd,
          raw: fullSectionRaw,
          value: fullSectionRaw.trim(),
        },
        ...(subsections.length > 0 ? { subsections } : {}),
      });
    } else {
      linePointer++;
    }
  }

  return {
    source,
    title: titleRange,
    headers: createCaseInsensitiveHeaders(rawHeaders),
    shortDescription: shortDescField,
    sections,
    diagnostics,
  };
}

/**
 * Parses subsections (=== Title ===, = Title =, or ### Title) within a section's body lines.
 */
function parseSubsections(bodyLines: LineInfo[], source: string): ParsedSubsection[] {
  const subsections: ParsedSubsection[] = [];
  let i = 0;

  while (i < bodyLines.length) {
    const line = bodyLines[i];
    const trimmed = line.raw.trim();

    // Match === Subtitle === or = Subtitle = or ### Subtitle
    const match =
      trimmed.match(/^===\s*([^=].*?)\s*===$/) ||
      trimmed.match(/^=\s*([^=].*?)\s*=$/) ||
      trimmed.match(/^###\s*(.+)$/);

    if (match) {
      const cleanSubTitle = match[1].trim();
      const rawSubTitle = match[1];
      const titleRange: SourceRange = {
        start: line.start,
        end: line.end,
        raw: line.raw,
        value: cleanSubTitle,
        line: line.lineNumber,
      };

      const subStartOffset = line.start;
      i++;

      const subBodyLines: LineInfo[] = [];
      while (i < bodyLines.length) {
        const nextLine = bodyLines[i];
        const nextTrimmed = nextLine.raw.trim();
        if (
          nextTrimmed.match(/^===\s*([^=].*?)\s*===$/) ||
          nextTrimmed.match(/^=\s*([^=].*?)\s*=$/) ||
          nextTrimmed.match(/^###\s*(.+)$/)
        ) {
          break;
        }
        subBodyLines.push(nextLine);
        i++;
      }

      let subBodyStart = line.lineEnd;
      let subBodyEnd = subBodyStart;
      let subBodyRaw = '';
      let subBodyValue = '';

      if (subBodyLines.length > 0) {
        const first = subBodyLines[0];
        const last = subBodyLines[subBodyLines.length - 1];
        subBodyStart = first.start;
        subBodyEnd = last.end;
        subBodyRaw = source.slice(subBodyStart, subBodyEnd);
        subBodyValue = subBodyRaw.trim();
      }

      const fullSubEnd = subBodyLines.length > 0 ? subBodyLines[subBodyLines.length - 1].end : line.end;
      const fullSubRaw = source.slice(subStartOffset, fullSubEnd);

      subsections.push({
        title: cleanSubTitle,
        rawTitle: rawSubTitle,
        titleRange,
        body: subBodyValue,
        bodyRange: {
          start: subBodyStart,
          end: subBodyEnd,
          raw: subBodyRaw,
          value: subBodyValue,
        },
        range: {
          start: subStartOffset,
          end: fullSubEnd,
          raw: fullSubRaw,
          value: fullSubRaw.trim(),
        },
      });
    } else {
      i++;
    }
  }

  return subsections;
}

/**
 * Returns a header field from a parsed readme case-insensitively.
 */
export function getHeader(
  readme: ParsedReadme,
  keyName: string
): ParsedField | undefined {
  return readme.headers[keyName];
}

/**
 * Returns a section from a parsed readme by title (case-insensitive).
 */
export function getSection(
  readme: ParsedReadme,
  sectionTitle: string
): ParsedSection | undefined {
  const normalized = sectionTitle.toLowerCase().trim();
  return readme.sections.find((s) => s.title.toLowerCase().trim() === normalized);
}

/**
 * Serializes a parsed readme back to source text.
 * When no edits have occurred, returns the exact byte-equivalent source.
 */
export function serializeReadme(parsed: ParsedReadme): string {
  return parsed.source;
}
