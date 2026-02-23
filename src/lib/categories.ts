/**
 * Unified Category System
 *
 * Single source of truth for all debate categories.
 * Pure data module — no D1, no React dependencies.
 */

export interface Category {
  id: string;
  name: string;
  emoji: string;
  description: string;
  aliases: string[];
}

export const CATEGORIES: Category[] = [
  {
    id: 'philosophy',
    name: 'Philosophy',
    emoji: '🧠',
    description: 'The big questions humanity has wrestled with for millennia',
    aliases: ['philosophy', 'metaphysics', 'epistemology', 'existentialism'],
  },
  {
    id: 'ethics',
    name: 'Ethics & Morality',
    emoji: '⚖️',
    description: 'Right vs wrong in a complicated world',
    aliases: ['ethics', 'morality', 'moral', 'bioethics'],
  },
  {
    id: 'technology',
    name: 'Technology & AI',
    emoji: '🤖',
    description: 'The future is here, and it\'s complicated',
    aliases: ['technology', 'tech', 'ai', 'artificial-intelligence', 'digital', 'cyber'],
  },
  {
    id: 'society',
    name: 'Society & Culture',
    emoji: '🏛️',
    description: 'How we live together (or don\'t)',
    aliases: ['society', 'culture', 'social', 'sociology'],
  },
  {
    id: 'science',
    name: 'Science & Nature',
    emoji: '🔬',
    description: 'Understanding the universe and our place in it',
    aliases: ['science', 'nature', 'biology', 'physics', 'space', 'environment', 'climate'],
  },
  {
    id: 'pop-culture',
    name: 'Pop Culture',
    emoji: '🎬',
    description: 'The stuff everyone actually argues about',
    aliases: ['pop-culture', 'popculture', 'entertainment', 'media', 'movies', 'music', 'gaming'],
  },
  {
    id: 'relationships',
    name: 'Relationships & Dating',
    emoji: '💔',
    description: 'Love, sex, and everything complicated',
    aliases: ['relationships', 'dating', 'love', 'romance', 'marriage'],
  },
  {
    id: 'business',
    name: 'Business & Money',
    emoji: '💰',
    description: 'Capitalism, careers, and cash',
    aliases: ['business', 'economics', 'economy', 'finance', 'money', 'career', 'work'],
  },
  {
    id: 'hot-takes',
    name: 'Hot Takes',
    emoji: '🔥',
    description: 'Controversial opinions that will start arguments',
    aliases: ['hot-takes', 'hottakes', 'fun', 'silly', 'controversial'],
  },
  {
    id: 'politics',
    name: 'Politics & Power',
    emoji: '🗳️',
    description: 'The stuff that actually runs the world',
    aliases: ['politics', 'political', 'government', 'policy', 'law', 'legislation'],
  },
  {
    id: 'general',
    name: 'General',
    emoji: '💡',
    description: 'Other interesting debate topics',
    aliases: ['general', 'other', 'misc', 'miscellaneous'],
  },
];

// Lookup maps built once at module load
const categoryById = new Map<string, Category>();
const aliasToId = new Map<string, string>();

for (const cat of CATEGORIES) {
  categoryById.set(cat.id, cat);
  for (const alias of cat.aliases) {
    aliasToId.set(alias.toLowerCase(), cat.id);
  }
}

/**
 * Resolve a raw category string to a canonical category ID.
 * Handles legacy names, aliases, and case-insensitive matching.
 * Returns 'general' if no match is found.
 */
export function resolveCategory(raw: string | null | undefined): string {
  if (!raw) return 'general';
  const normalized = raw.toLowerCase().trim();

  // Direct match
  if (categoryById.has(normalized)) return normalized;

  // Alias match
  const aliased = aliasToId.get(normalized);
  if (aliased) return aliased;

  return 'general';
}

/**
 * Get a category by its canonical ID.
 */
export function getCategoryById(id: string): Category | undefined {
  return categoryById.get(id);
}

/**
 * Get the emoji for a category ID. Returns '💡' for unknown categories.
 */
export function getCategoryEmoji(id: string): string {
  return categoryById.get(id)?.emoji ?? '💡';
}

/**
 * Get all category IDs.
 */
export function getCategoryIds(): string[] {
  return CATEGORIES.map((c) => c.id);
}
