/**
 * Types and interfaces for WordPress readme.txt and PHP plugin header parsing.
 */

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface SourcePosition {
  line: number;   // 1-indexed line number
  column: number; // 1-indexed column number
  offset: number; // 0-indexed byte/char offset in source
}

export interface SourceRange {
  start: number;  // 0-indexed character offset in original source
  end: number;    // 0-indexed character offset in original source
  raw: string;    // Exact substring from source[start..end]
  value: string;  // Parsed and trimmed string value
  line?: number;  // 1-indexed line number where this range begins
}

export interface ParsedField extends SourceRange {
  key: string;              // Canonical/normalized key name
  rawKey: string;           // Exact key text before the colon
  rawKeyRange?: { start: number; end: number };
  rawValueRange?: { start: number; end: number };
  values?: string[];        // For list fields (e.g. Tags, Contributors)
}

export interface ParsedSubsection {
  title: string;
  rawTitle: string;
  titleRange: SourceRange;
  body: string;
  bodyRange: SourceRange;
  range: SourceRange;
}

export interface ParsedSection {
  title: string;            // Clean section title (e.g. "Description", "Installation", etc.)
  rawTitle: string;         // Exact title string inside == ==
  titleRange: SourceRange;  // Range of the `== Section Title ==` line
  body: string;             // Content of the section body
  bodyRange: SourceRange;   // Range of the section body content
  range: SourceRange;       // Full range spanning from start of section heading to end of body
  subsections?: ParsedSubsection[];
}

export interface ParseDiagnostic {
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  range?: { start: number; end: number };
  line?: number;
  column?: number;
}

export interface ParsedReadme {
  source: string;
  title: SourceRange | null;
  headers: Record<string, ParsedField>;
  shortDescription: ParsedField | null;
  sections: ParsedSection[];
  diagnostics: ParseDiagnostic[];
}

export interface ReadmeParserOptions {
  maxSizeBytes?: number;
}

export interface ParsedPhpHeaderField extends SourceRange {
  key: string;
  rawKey: string;
  rawKeyRange?: { start: number; end: number };
  rawValueRange?: { start: number; end: number };
}

export interface ParsedPhpHeaders {
  source: string;
  fields: Record<string, ParsedPhpHeaderField>;
  pluginName: ParsedPhpHeaderField | null;
  version: ParsedPhpHeaderField | null;
  requiresAtLeast: ParsedPhpHeaderField | null;
  requiresPhp: ParsedPhpHeaderField | null;
  textDomain: ParsedPhpHeaderField | null;
  license: ParsedPhpHeaderField | null;
  description: ParsedPhpHeaderField | null;
  author: ParsedPhpHeaderField | null;
  authorUri: ParsedPhpHeaderField | null;
  pluginUri: ParsedPhpHeaderField | null;
  domainPath: ParsedPhpHeaderField | null;
  network: ParsedPhpHeaderField | null;
  updateUri: ParsedPhpHeaderField | null;
  requiresPlugins: ParsedPhpHeaderField | null;
  headerRange: SourceRange | null;
  diagnostics: ParseDiagnostic[];
}

export interface PhpHeaderParserOptions {
  maxSizeBytes?: number;
}
