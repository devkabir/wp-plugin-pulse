import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_MAX_PHP_SIZE,
  getPhpHeader,
  parsePhpHeader,
  serializePhpHeader,
} from './php-header-parser.ts';

const PHP_FIXTURE_PATH = 'src/domain/readme-fixtures/main-plugin.php.txt';

describe('PR 7 — PHP Header Parser', () => {
  it('parses a valid WordPress main plugin PHP file strictly as text', async () => {
    const source = await Bun.file(PHP_FIXTURE_PATH).text();

    const parsed = parsePhpHeader(source);

    // Byte-equivalence test
    expect(serializePhpHeader(parsed)).toBe(source);
    expect(parsed.diagnostics.length).toBe(0);

    // Header values
    expect(parsed.pluginName?.value).toBe('WP Form Pulse');
    expect(parsed.version?.value).toBe('2.4.1');
    expect(parsed.requiresAtLeast?.value).toBe('5.8');
    expect(parsed.requiresPhp?.value).toBe('7.4');
    expect(parsed.textDomain?.value).toBe('wp-form-pulse');
    expect(parsed.license?.value).toBe('GPLv2 or later');
    expect(parsed.author?.value).toBe('WP Pulse Team');
    expect(parsed.pluginUri?.value).toBe('https://example.com/wp-form-pulse');
    expect(parsed.requiresPlugins?.value).toBe('woocommerce');

    // Case-insensitive lookup
    expect(parsed.fields['plugin name']?.value).toBe('WP Form Pulse');
    expect(parsed.fields['REQUIRES AT LEAST']?.value).toBe('5.8');
    expect(getPhpHeader(parsed, 'Requires PHP')?.value).toBe('7.4');

    // Range slices
    expect(source.slice(parsed.pluginName!.start, parsed.pluginName!.end)).toContain('Plugin Name: WP Form Pulse');
    expect(source.slice(parsed.pluginName!.rawKeyRange!.start, parsed.pluginName!.rawKeyRange!.end)).toBe('Plugin Name');
    expect(source.slice(parsed.pluginName!.rawValueRange!.start, parsed.pluginName!.rawValueRange!.end)).toBe('WP Form Pulse');
  });

  it('works identically with CRLF line endings', async () => {
    const lfSource = await Bun.file(PHP_FIXTURE_PATH).text();
    const crlfSource = lfSource.replace(/\n/g, '\r\n');

    const parsed = parsePhpHeader(crlfSource);

    expect(serializePhpHeader(parsed)).toBe(crlfSource);
    expect(parsed.pluginName?.value).toBe('WP Form Pulse');
    expect(parsed.version?.value).toBe('2.4.1');
    expect(crlfSource.slice(parsed.version!.start, parsed.version!.end)).toContain('Version: 2.4.1');
  });

  it('parses single-line comment style plugin headers', () => {
    const source = `<?php
// Plugin Name: Single Line Plugin
// Version: 1.0.0
// Requires at least: 6.0
// Requires PHP: 8.0
// Text Domain: single-line
// License: GPL-2.0+

echo "Hello";
`;
    const parsed = parsePhpHeader(source);

    expect(parsed.pluginName?.value).toBe('Single Line Plugin');
    expect(parsed.version?.value).toBe('1.0.0');
    expect(parsed.requiresAtLeast?.value).toBe('6.0');
    expect(parsed.requiresPhp?.value).toBe('8.0');
    expect(parsed.textDomain?.value).toBe('single-line');
    expect(parsed.license?.value).toBe('GPL-2.0+');
  });

  it('emits diagnostics when required headers are missing without throwing', () => {
    const source = `<?php
/**
 * Plugin Name: Minimal Plugin
 * Description: Missing version, requires at least, and PHP.
 */
`;
    const parsed = parsePhpHeader(source);

    expect(parsed.pluginName?.value).toBe('Minimal Plugin');
    expect(parsed.version).toBeNull();
    expect(parsed.requiresAtLeast).toBeNull();

    const codes = parsed.diagnostics.map((d) => d.code);
    expect(codes).toContain('MISSING_VERSION');
    expect(codes).toContain('MISSING_REQUIRES_AT_LEAST');
    expect(codes).toContain('MISSING_REQUIRES_PHP');
    expect(codes).toContain('MISSING_LICENSE');
  });

  it('emits diagnostic when file has no plugin header docblock', () => {
    const source = `<?php
function some_random_function() {
    return true;
}
`;
    const parsed = parsePhpHeader(source);

    expect(parsed.pluginName).toBeNull();
    expect(parsed.headerRange).toBeNull();
    const codes = parsed.diagnostics.map((d) => d.code);
    expect(codes).toContain('MISSING_PLUGIN_HEADER');
  });

  it('rejects files exceeding size limit with FILE_TOO_LARGE diagnostic', () => {
    const hugeSource = `<?php\n/*\n * Plugin Name: Huge\n */\n` + '0'.repeat(DEFAULT_MAX_PHP_SIZE + 100);
    const parsed = parsePhpHeader(hugeSource);

    expect(parsed.diagnostics.length).toBe(1);
    expect(parsed.diagnostics[0].code).toBe('FILE_TOO_LARGE');
    expect(parsed.diagnostics[0].severity).toBe('error');
  });

  it('detects duplicate headers within the PHP docblock', () => {
    const source = `<?php
/**
 * Plugin Name: Test Plugin
 * Version: 1.0.0
 * Version: 1.0.1
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License: GPLv2
 * Text Domain: test
 */
`;
    const parsed = parsePhpHeader(source);

    const codes = parsed.diagnostics.map((d) => d.code);
    expect(codes).toContain('DUPLICATE_HEADER');
  });

  it('never executes PHP code under any circumstances', () => {
    let executed = false;
    (globalThis as unknown as { __MALICIOUS_EXEC_FLAG?: boolean }).__MALICIOUS_EXEC_FLAG = false;

    const evilPhpSource = `<?php
/**
 * Plugin Name: Malicious Attempt
 * Version: 1.0.0
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License: GPLv2
 * Text Domain: evil
 */
globalThis.__MALICIOUS_EXEC_FLAG = true;
throw new Error("PHP code execution must never happen!");
`;

    const parsed = parsePhpHeader(evilPhpSource);
    expect(parsed.pluginName?.value).toBe('Malicious Attempt');
    expect((globalThis as unknown as { __MALICIOUS_EXEC_FLAG?: boolean }).__MALICIOUS_EXEC_FLAG).toBe(false);
    expect(executed).toBe(false);
  });
});
