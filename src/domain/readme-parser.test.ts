import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_MAX_README_SIZE,
  getHeader,
  getSection,
  parseReadme,
  serializeReadme,
} from './readme-parser.ts';

const VALID_README_PATH = 'src/domain/readme-fixtures/valid-readme.txt';
const MALFORMED_README_PATH = 'src/domain/readme-fixtures/malformed-readme.txt';

describe('PR 7 — Readme Parser', () => {
  it('parses a valid WordPress readme with byte-equivalent roundtrip', async () => {
    const source = await Bun.file(VALID_README_PATH).text();

    const parsed = parseReadme(source);

    // Byte-equivalence test
    expect(serializeReadme(parsed)).toBe(source);
    expect(parsed.diagnostics.length).toBe(0);

    // Title checks
    expect(parsed.title).not.toBeNull();
    expect(parsed.title?.value).toBe('WP Form Pulse');
    expect(source.slice(parsed.title!.start, parsed.title!.end)).toBe('=== WP Form Pulse ===');

    // Known and custom headers
    expect(parsed.headers['Requires at least']?.value).toBe('5.8');
    expect(parsed.headers['requires at least']?.value).toBe('5.8');
    expect(parsed.headers['TESTED UP TO']?.value).toBe('6.7');
    expect(parsed.headers['Stable tag']?.value).toBe('2.4.1');
    expect(parsed.headers['Requires PHP']?.value).toBe('7.4');
    expect(parsed.headers['Tags']?.values).toEqual([
      'forms',
      'contact-form',
      'spam-protection',
      'gutenberg',
      'builder',
    ]);
    expect(parsed.headers['Contributors']?.values).toEqual(['devkabir', 'wpcrew']);
    expect(parsed.headers['Requires Plugins']?.values).toEqual(['woocommerce']);

    // Unknown header preserved
    expect(parsed.headers['Custom Header']?.value).toBe('custom-value');
    expect(getHeader(parsed, 'custom header')?.value).toBe('custom-value');

    // Short description
    expect(parsed.shortDescription).not.toBeNull();
    expect(parsed.shortDescription?.value).toBe(
      'Lightweight and responsive form builder for WordPress with anti-spam protection.'
    );
    expect(source.slice(parsed.shortDescription!.start, parsed.shortDescription!.end)).toBe(
      'Lightweight and responsive form builder for WordPress with anti-spam protection.'
    );

    // Sections
    expect(parsed.sections.length).toBe(7);
    const descSection = getSection(parsed, 'Description');
    expect(descSection).toBeDefined();
    expect(descSection?.subsections?.length).toBe(1);
    expect(descSection?.subsections?.[0].title).toBe('Core Features');

    // Custom section preserved intact
    const customSection = getSection(parsed, 'Integrations and Privacy');
    expect(customSection).toBeDefined();
    expect(customSection?.body).toContain('This plugin does not collect personal visitor data');
  });

  it('works identically with CRLF line endings', async () => {
    const lfSource = await Bun.file(VALID_README_PATH).text();
    const crlfSource = lfSource.replace(/\n/g, '\r\n');

    const parsed = parseReadme(crlfSource);

    expect(serializeReadme(parsed)).toBe(crlfSource);
    expect(parsed.title?.value).toBe('WP Form Pulse');
    expect(crlfSource.slice(parsed.title!.start, parsed.title!.end)).toBe('=== WP Form Pulse ===');

    // Test offset slice on CRLF
    const tagsField = parsed.headers['tags'];
    expect(tagsField).toBeDefined();
    expect(crlfSource.slice(tagsField!.start, tagsField!.end)).toContain('Tags: forms, contact-form');

    const faq = getSection(parsed, 'Frequently Asked Questions');
    expect(faq).toBeDefined();
    expect(faq?.subsections?.length).toBe(2);
    expect(faq?.subsections?.[0].title).toBe('Does it work with block themes?');
  });

  it('parses malformed readme with diagnostics rather than throwing uncaught errors', async () => {
    const source = await Bun.file(MALFORMED_README_PATH).text();

    const parsed = parseReadme(source);

    expect(serializeReadme(parsed)).toBe(source);
    expect(parsed.diagnostics.length).toBeGreaterThan(0);

    const codes = parsed.diagnostics.map((d) => d.code);
    expect(codes).toContain('MALFORMED_TITLE');
    expect(codes).toContain('DUPLICATE_HEADER');
    expect(codes).toContain('MISSING_BLANK_LINE');
    expect(codes).toContain('DUPLICATE_SECTION');

    // Verify malformed title was still extracted
    expect(parsed.title?.value).toBe('Malformed Plugin Title');

    // Verify custom section preserved
    const customSection = getSection(parsed, 'Custom Analytics');
    expect(customSection).toBeDefined();
    expect(customSection?.body).toBe('Special custom section content.');
  });

  it('detects missing plugin title when file starts with headers directly', () => {
    const source = `Contributors: devkabir\nTags: tag1\n\n== Description ==\n\nSome text.`;
    const parsed = parseReadme(source);

    expect(parsed.title).toBeNull();
    const codes = parsed.diagnostics.map((d) => d.code);
    expect(codes).toContain('MISSING_TITLE');
  });

  it('rejects files exceeding the maximum size limit with useful diagnostic', () => {
    const hugeSource = '=== Large Plugin ===\n' + 'A'.repeat(DEFAULT_MAX_README_SIZE + 100);
    const parsed = parseReadme(hugeSource);

    expect(parsed.diagnostics.length).toBe(1);
    expect(parsed.diagnostics[0].code).toBe('FILE_TOO_LARGE');
    expect(parsed.diagnostics[0].severity).toBe('error');
    expect(parsed.diagnostics[0].message).toContain('exceeds maximum limit');
  });

  it('allows custom maxSizeBytes configuration in options', () => {
    const source = '=== Custom Limit Plugin ===\nContributors: test\n';
    const parsed = parseReadme(source, { maxSizeBytes: 20 });

    expect(parsed.diagnostics.length).toBe(1);
    expect(parsed.diagnostics[0].code).toBe('FILE_TOO_LARGE');
  });

  it('handles completely empty or whitespace-only files gracefully', () => {
    const parsedEmpty = parseReadme('');
    expect(parsedEmpty.diagnostics.some((d) => d.code === 'EMPTY_FILE')).toBe(true);

    const parsedWhitespace = parseReadme('   \n\n  \t  \n');
    expect(parsedWhitespace.diagnostics.some((d) => d.code === 'EMPTY_FILE')).toBe(true);
  });

  it('preserves field rawKeyRange and rawValueRange accurately', () => {
    const source = `=== Test Plugin ===\n\nRequires at least: 6.2\nTested up to: 6.7\n\n== Description ==\n\nContent.`;
    const parsed = parseReadme(source);

    const reqField = parsed.headers['Requires at least'];
    expect(reqField).toBeDefined();
    expect(reqField?.rawKeyRange).toBeDefined();
    expect(source.slice(reqField!.rawKeyRange!.start, reqField!.rawKeyRange!.end)).toBe('Requires at least');
    expect(source.slice(reqField!.rawValueRange!.start, reqField!.rawValueRange!.end)).toBe('6.2');
  });
});
