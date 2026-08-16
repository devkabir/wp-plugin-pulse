import type { NormalizedPlugin, NormalizedTag, TagComparison, TagFrequencyItem } from './plugin-types';

/**
 * Normalizes any tag string into a consistent lowercase slug.
 * Converts spaces and underscores to hyphens, removes special punctuation,
 * collapses multiple consecutive hyphens, and trims leading/trailing hyphens.
 */
export function normalizeTagSlug(rawTag: string): string {
  if (!rawTag || typeof rawTag !== 'string') return '';
  return rawTag
    .toLowerCase()
    .trim()
    .replace(/[_/\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Normalizes a list of raw tag strings for a single plugin.
 * Deduplicates by slug, preserving the first clean display label.
 */
export function normalizePluginTags(rawTags: readonly string[]): NormalizedTag[] {
  if (!Array.isArray(rawTags)) return [];
  const seen = new Map<string, string>();

  for (const raw of rawTags) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const slug = normalizeTagSlug(trimmed);
    if (!slug) continue;
    if (!seen.has(slug)) {
      seen.set(slug, trimmed);
    }
  }

  return Array.from(seen.entries()).map(([slug, label]) => ({ slug, label }));
}

/**
 * Calculates tag frequency and usage across a collection of plugins.
 * Only the provided plugin set is used for counting.
 * Output is deterministic: sorted by count descending, then slug ascending.
 */
export function calculateTagFrequency(plugins: readonly NormalizedPlugin[]): TagFrequencyItem[] {
  if (!Array.isArray(plugins) || plugins.length === 0) {
    return [];
  }

  const slugMap = new Map<
    string,
    { label: string; count: number; pluginSlugs: Set<string> }
  >();

  for (const plugin of plugins) {
    const pluginSlug = plugin.slug || plugin.name;
    const normalizedTags = normalizePluginTags(plugin.tags);

    for (const { slug, label } of normalizedTags) {
      const existing = slugMap.get(slug);
      if (existing) {
        existing.count += 1;
        existing.pluginSlugs.add(pluginSlug);
        // Prefer labels with uppercase letters or spaces if available
        if (label !== slug && existing.label === slug) {
          existing.label = label;
        }
      } else {
        slugMap.set(slug, {
          label,
          count: 1,
          pluginSlugs: new Set([pluginSlug]),
        });
      }
    }
  }

  const results: TagFrequencyItem[] = Array.from(slugMap.entries()).map(
    ([slug, data]) => ({
      slug,
      label: data.label,
      count: data.count,
      pluginSlugs: Array.from(data.pluginSlugs).sort((a, b) => a.localeCompare(b)),
    })
  );

  results.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.slug.localeCompare(b.slug);
  });

  return results;
}

/**
 * Compares tags between a subject plugin and a set of competitor plugins.
 * Identifies shared tags, subject-only tags, and competitor-only tags with user attribution.
 */
export function compareTags(
  subject: NormalizedPlugin,
  competitors: readonly NormalizedPlugin[]
): TagComparison {
  const subjectTags = normalizePluginTags(subject.tags);
  const subjectSlugMap = new Map(subjectTags.map((t) => [t.slug, t.label]));

  const competitorTagMap = new Map<string, { label: string; usedBy: Set<string> }>();

  for (const competitor of competitors) {
    const compSlug = competitor.slug || competitor.name;
    const compTags = normalizePluginTags(competitor.tags);

    for (const { slug, label } of compTags) {
      const existing = competitorTagMap.get(slug);
      if (existing) {
        existing.usedBy.add(compSlug);
        if (label !== slug && existing.label === slug) {
          existing.label = label;
        }
      } else {
        competitorTagMap.set(slug, {
          label,
          usedBy: new Set([compSlug]),
        });
      }
    }
  }

  const sharedSlugs: string[] = [];
  const subjectOnlySlugs: string[] = [];

  for (const [slug, label] of subjectSlugMap.entries()) {
    if (competitorTagMap.has(slug)) {
      sharedSlugs.push(label);
    } else {
      subjectOnlySlugs.push(label);
    }
  }

  const competitorOnly: Array<{ tag: string; usedBy: string[] }> = [];

  for (const [slug, { label, usedBy }] of competitorTagMap.entries()) {
    if (!subjectSlugMap.has(slug)) {
      competitorOnly.push({
        tag: label,
        usedBy: Array.from(usedBy).sort((a, b) => a.localeCompare(b)),
      });
    }
  }

  // Deterministic sorting
  sharedSlugs.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  subjectOnlySlugs.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  competitorOnly.sort((a, b) => {
    if (b.usedBy.length !== a.usedBy.length) {
      return b.usedBy.length - a.usedBy.length;
    }
    return a.tag.localeCompare(b.tag, undefined, { sensitivity: 'base' });
  });

  return {
    shared: sharedSlugs,
    subjectOnly: subjectOnlySlugs,
    competitorOnly,
  };
}
