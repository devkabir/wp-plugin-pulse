import type {
  ParsedPhpHeaderField,
  ParsedPhpHeaders,
  ParseDiagnostic,
  PhpHeaderParserOptions,
  SourceRange,
} from './readme-types.ts';
import { createCaseInsensitiveHeaders } from './readme-parser.ts';

export const DEFAULT_MAX_PHP_SIZE = 2 * 1024 * 1024; // 2 MB

const KNOWN_PHP_HEADER_CANONICAL: Record<string, string> = {
  'plugin name': 'Plugin Name',
  'plugin uri': 'Plugin URI',
  description: 'Description',
  version: 'Version',
  'requires at least': 'Requires at least',
  'requires php': 'Requires PHP',
  author: 'Author',
  'author uri': 'Author URI',
  license: 'License',
  'license uri': 'License URI',
  'text domain': 'Text Domain',
  'domain path': 'Domain Path',
  network: 'Network',
  'update uri': 'Update URI',
  'requires plugins': 'Requires Plugins',
};

/**
 * Parses a WordPress main plugin PHP file docblock strictly as text without executing PHP.
 */
export function parsePhpHeader(
  source: string,
  options: PhpHeaderParserOptions = {}
): ParsedPhpHeaders {
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_PHP_SIZE;
  const diagnostics: ParseDiagnostic[] = [];

  if (source.length > maxSizeBytes) {
    diagnostics.push({
      code: 'FILE_TOO_LARGE',
      message: `PHP file size (${source.length} bytes) exceeds maximum limit of ${maxSizeBytes} bytes.`,
      severity: 'error',
      range: { start: 0, end: source.length },
      line: 1,
    });
    return buildEmptyPhpHeaders(source, diagnostics);
  }

  if (!source.trim()) {
    diagnostics.push({
      code: 'EMPTY_FILE',
      message: 'PHP file is empty.',
      severity: 'error',
      line: 1,
    });
    return buildEmptyPhpHeaders(source, diagnostics);
  }

  // Find docblock comment (/* ... */) containing "Plugin Name:"
  let docblockMatch: { start: number; end: number; content: string } | null = null;
  const blockCommentRegex = /\/\*([\s\S]*?)\*\//g;
  let match: RegExpExecArray | null;

  while ((match = blockCommentRegex.exec(source)) !== null) {
    if (/Plugin\s+Name\s*:/i.test(match[1])) {
      docblockMatch = {
        start: match.index,
        end: match.index + match[0].length,
        content: match[0],
      };
      break;
    }
  }

  // If no block comment with Plugin Name found, check single-line comment block
  let isSingleLineBlock = false;
  if (!docblockMatch) {
    const singleLineMatch = /^(?:[ \t]*\/\/[^\r\n]*[\r\n]+)*[ \t]*\/\/[^\r\n]*Plugin\s+Name\s*:[^\r\n]*/im.exec(source);
    if (singleLineMatch) {
      const startIdx = singleLineMatch.index;
      // Expand to include contiguous single-line comment lines
      const rest = source.slice(startIdx);
      const fullSingleBlockMatch = /^(?:[ \t]*\/\/[^\r\n]*(?:\r\n|\r|\n|$))+/.exec(rest);
      if (fullSingleBlockMatch) {
        docblockMatch = {
          start: startIdx,
          end: startIdx + fullSingleBlockMatch[0].length,
          content: fullSingleBlockMatch[0],
        };
        isSingleLineBlock = true;
      }
    }
  }

  if (!docblockMatch) {
    diagnostics.push({
      code: 'MISSING_PLUGIN_HEADER',
      message: 'No WordPress plugin header comment with "Plugin Name:" was found.',
      severity: 'error',
      line: 1,
    });
    return buildEmptyPhpHeaders(source, diagnostics);
  }

  const headerRange: SourceRange = {
    start: docblockMatch.start,
    end: docblockMatch.end,
    raw: docblockMatch.content,
    value: docblockMatch.content.trim(),
    line: calculateLineNumber(source, docblockMatch.start),
  };

  const fields: Record<string, ParsedPhpHeaderField> = {};
  const seenKeys = new Set<string>();

  // Process lines within the docblock
  const docblockLines = scanCommentLines(source, docblockMatch.start, docblockMatch.end, isSingleLineBlock);

  for (const line of docblockLines) {
    const colonIdx = line.textAfterCommentMarker.indexOf(':');
    if (colonIdx <= 0) continue;

    const rawKeyPart = line.textAfterCommentMarker.substring(0, colonIdx);
    const rawValPart = line.textAfterCommentMarker.substring(colonIdx + 1);

    const keyName = rawKeyPart.trim();
    const value = rawValPart.trim();
    const lowerKey = keyName.toLowerCase();

    // Key range
    const keyOffsetInLine = line.markerOffsetInLine + line.markerLength + (rawKeyPart.length - rawKeyPart.trimStart().length);
    const keyStart = line.start + keyOffsetInLine;
    const keyEnd = keyStart + keyName.length;

    // Value range
    const valOffsetInLine = line.markerOffsetInLine + line.markerLength + colonIdx + 1 + (rawValPart.length - rawValPart.trimStart().length);
    const valueStart = line.start + valOffsetInLine;
    const valueEnd = valueStart + value.length;

    if (seenKeys.has(lowerKey)) {
      diagnostics.push({
        code: 'DUPLICATE_HEADER',
        message: `Duplicate PHP header "${keyName}" on line ${line.lineNumber}.`,
        severity: 'warning',
        range: { start: line.start, end: line.end },
        line: line.lineNumber,
      });
    }
    seenKeys.add(lowerKey);

    const canonicalKey = KNOWN_PHP_HEADER_CANONICAL[lowerKey] || keyName;

    const field: ParsedPhpHeaderField = {
      key: canonicalKey,
      rawKey: keyName,
      rawKeyRange: { start: keyStart, end: keyEnd },
      rawValueRange: { start: valueStart, end: valueEnd },
      start: line.start,
      end: line.end,
      raw: line.raw,
      value,
      line: line.lineNumber,
    };

    fields[canonicalKey] = field;
    if (canonicalKey !== lowerKey) {
      fields[lowerKey] = field;
    }
  }

  const caseInsensitiveFields = createCaseInsensitiveHeaders(fields);

  // Extract core properties
  const pluginName = caseInsensitiveFields['Plugin Name'] ?? null;
  const version = caseInsensitiveFields['Version'] ?? null;
  const requiresAtLeast = caseInsensitiveFields['Requires at least'] ?? null;
  const requiresPhp = caseInsensitiveFields['Requires PHP'] ?? null;
  const textDomain = caseInsensitiveFields['Text Domain'] ?? null;
  const license = caseInsensitiveFields['License'] ?? null;
  const description = caseInsensitiveFields['Description'] ?? null;
  const author = caseInsensitiveFields['Author'] ?? null;
  const authorUri = caseInsensitiveFields['Author URI'] ?? null;
  const pluginUri = caseInsensitiveFields['Plugin URI'] ?? null;
  const domainPath = caseInsensitiveFields['Domain Path'] ?? null;
  const network = caseInsensitiveFields['Network'] ?? null;
  const updateUri = caseInsensitiveFields['Update URI'] ?? null;
  const requiresPlugins = caseInsensitiveFields['Requires Plugins'] ?? null;

  // Validate core headers
  if (!pluginName || !pluginName.value) {
    diagnostics.push({
      code: 'EMPTY_PLUGIN_NAME',
      message: 'Plugin Name header is empty.',
      severity: 'error',
      range: headerRange,
      line: headerRange.line,
    });
  }

  if (!version) {
    diagnostics.push({
      code: 'MISSING_VERSION',
      message: 'Main plugin PHP header is missing "Version:".',
      severity: 'warning',
      range: headerRange,
      line: headerRange.line,
    });
  }

  if (!requiresAtLeast) {
    diagnostics.push({
      code: 'MISSING_REQUIRES_AT_LEAST',
      message: 'Main plugin PHP header is missing "Requires at least:".',
      severity: 'warning',
      range: headerRange,
      line: headerRange.line,
    });
  }

  if (!requiresPhp) {
    diagnostics.push({
      code: 'MISSING_REQUIRES_PHP',
      message: 'Main plugin PHP header is missing "Requires PHP:".',
      severity: 'warning',
      range: headerRange,
      line: headerRange.line,
    });
  }

  if (!license) {
    diagnostics.push({
      code: 'MISSING_LICENSE',
      message: 'Main plugin PHP header is missing "License:".',
      severity: 'warning',
      range: headerRange,
      line: headerRange.line,
    });
  }

  if (!textDomain) {
    diagnostics.push({
      code: 'MISSING_TEXT_DOMAIN',
      message: 'Main plugin PHP header is missing "Text Domain:".',
      severity: 'info',
      range: headerRange,
      line: headerRange.line,
    });
  }

  return {
    source,
    fields: caseInsensitiveFields,
    pluginName,
    version,
    requiresAtLeast,
    requiresPhp,
    textDomain,
    license,
    description,
    author,
    authorUri,
    pluginUri,
    domainPath,
    network,
    updateUri,
    requiresPlugins,
    headerRange,
    diagnostics,
  };
}

interface ParsedCommentLine {
  start: number;
  end: number;
  lineNumber: number;
  raw: string;
  markerOffsetInLine: number;
  markerLength: number;
  textAfterCommentMarker: string;
}

function scanCommentLines(
  source: string,
  blockStart: number,
  blockEnd: number,
  isSingleLineBlock: boolean
): ParsedCommentLine[] {
  const result: ParsedCommentLine[] = [];
  const blockText = source.slice(blockStart, blockEnd);
  const lineRegex = /([^\r\n]*)(\r\n|\r|\n|$)/g;
  let match: RegExpExecArray | null;
  let offset = blockStart;
  let lineNumber = calculateLineNumber(source, blockStart);

  while ((match = lineRegex.exec(blockText)) !== null) {
    if (match.index === blockText.length && result.length > 0) {
      break;
    }

    const raw = match[1];
    const start = offset;
    const end = start + raw.length;
    const lineEnd = end + match[2].length;

    // Detect comment markers: /**, /*, *, //
    let markerOffsetInLine = 0;
    let markerLength = 0;
    let textAfterMarker = raw;

    if (isSingleLineBlock) {
      const slashMatch = /^[ \t]*\/\/[ \t]*/.exec(raw);
      if (slashMatch) {
        markerOffsetInLine = 0;
        markerLength = slashMatch[0].length;
        textAfterMarker = raw.substring(markerLength);
      }
    } else {
      const docMatch = /^[ \t]*(\/\*\*|\/\*|\*\/|\*)[ \t]*/.exec(raw);
      if (docMatch) {
        markerOffsetInLine = 0;
        markerLength = docMatch[0].length;
        textAfterMarker = raw.substring(markerLength);
      }
    }

    result.push({
      start,
      end,
      lineNumber,
      raw,
      markerOffsetInLine,
      markerLength,
      textAfterCommentMarker: textAfterMarker,
    });

    offset = lineEnd;
    lineNumber++;
    if (match.index + match[0].length >= blockText.length) {
      break;
    }
  }

  return result;
}

function calculateLineNumber(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
    }
  }
  return line;
}

function buildEmptyPhpHeaders(
  source: string,
  diagnostics: ParseDiagnostic[]
): ParsedPhpHeaders {
  return {
    source,
    fields: createCaseInsensitiveHeaders({}),
    pluginName: null,
    version: null,
    requiresAtLeast: null,
    requiresPhp: null,
    textDomain: null,
    license: null,
    description: null,
    author: null,
    authorUri: null,
    pluginUri: null,
    domainPath: null,
    network: null,
    updateUri: null,
    requiresPlugins: null,
    headerRange: null,
    diagnostics,
  };
}

/**
 * Returns a PHP header field case-insensitively.
 */
export function getPhpHeader(
  headers: ParsedPhpHeaders,
  keyName: string
): ParsedPhpHeaderField | undefined {
  return headers.fields[keyName];
}

/**
 * Serializes parsed PHP headers back to source text.
 * When no edits have occurred, returns the exact byte-equivalent source.
 */
export function serializePhpHeader(parsed: ParsedPhpHeaders): string {
  return parsed.source;
}
