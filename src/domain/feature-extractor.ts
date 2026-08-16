import { resolveFeatureDictionary } from './feature-dictionary';
import type {
  ExtractedFeature,
  FeatureDefinition,
  FeatureEvidence,
  FeatureStatus,
  NormalizedPlugin,
} from './plugin-types';
import { normalizePluginTags } from './tag-intelligence';

/**
 * Extracts a readable context snippet around a matched substring within text.
 */
function createSnippet(text: string, index: number, length: number, radius = 40): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  let snippet = text.slice(start, end).trim().replace(/\s+/g, ' ');

  if (start > 0) snippet = `...${snippet}`;
  if (end < text.length) snippet = `${snippet}...`;

  return snippet;
}

/**
 * Extracts evidence for a single feature from a plugin's tags, short description, and full description.
 */
export function extractFeatureForPlugin(
  plugin: NormalizedPlugin,
  feature: FeatureDefinition
): ExtractedFeature {
  const evidence: FeatureEvidence[] = [];
  const seenMatches = new Set<string>();

  const recordEvidence = (field: FeatureEvidence['field'], matchedText: string, snippet: string) => {
    const key = `${field}:${matchedText.toLowerCase()}`;
    if (!seenMatches.has(key)) {
      seenMatches.add(key);
      evidence.push({ field, matchedText, snippet });
    }
  };

  // 1. Match against tags
  const normalizedTags = normalizePluginTags(plugin.tags);
  for (const { slug, label } of normalizedTags) {
    if (feature.tagSlugs.includes(slug)) {
      recordEvidence('tag', label, `Tag: ${label}`);
      continue;
    }
    for (const pattern of feature.patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(label);
      if (match) {
        recordEvidence('tag', match[0], `Tag: ${label}`);
        break;
      }
    }
  }

  // 2. Match against short description
  if (plugin.shortDescription && typeof plugin.shortDescription === 'string') {
    for (const pattern of feature.patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(plugin.shortDescription);
      if (match && typeof match.index === 'number') {
        const snippet = createSnippet(plugin.shortDescription, match.index, match[0].length);
        recordEvidence('short_description', match[0], snippet);
      }
    }
  }

  // 3. Match against full description when loaded
  const hasFullDescription = Boolean(
    plugin.description && typeof plugin.description === 'string' && plugin.description.trim().length > 0
  );

  if (hasFullDescription && plugin.description) {
    for (const pattern of feature.patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(plugin.description);
      if (match && typeof match.index === 'number') {
        const snippet = createSnippet(plugin.description, match.index, match[0].length);
        recordEvidence('description', match[0], snippet);
      }
    }
  }

  // Status determination
  let status: FeatureStatus;
  if (evidence.length > 0) {
    status = 'present';
  } else if (hasFullDescription) {
    // Both short & full descriptions were searched and yielded no match
    status = 'absent';
  } else {
    // Full description was not loaded; do not assume absence
    status = 'unknown';
  }

  return {
    featureId: feature.id,
    featureName: feature.name,
    status,
    evidence,
  };
}

/**
 * Extracts all features defined in the feature dictionary for a given plugin.
 * Deterministic and pure with zero network or DOM access.
 */
export function extractPluginFeatures(
  plugin: NormalizedPlugin,
  customDictionary?: readonly FeatureDefinition[]
): ExtractedFeature[] {
  if (!plugin) return [];
  const dictionary = customDictionary && customDictionary.length > 0
    ? customDictionary
    : resolveFeatureDictionary([plugin]);
  return dictionary.map((feature) => extractFeatureForPlugin(plugin, feature));
}
