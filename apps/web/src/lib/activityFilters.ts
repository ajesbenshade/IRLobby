import type { ActivityFilters } from '@/types/activity';

/**
 * Query string for GET /api/activities/.
 * Location, radius, and dates keep the #68 mapping.
 * Type, Audience, and Ages use Backend #69: type=, audience=, ages=.
 * Defaults (All types, Everyone, All ages) are omitted.
 * Never send price_min, price_max, skill_level, tags, age_restriction, or category.
 */

export const ALL_GATHERING_TYPES = 'All types';
export const EVERYONE_AUDIENCE = 'Everyone';
export const ALL_AGES = 'All ages';

export const GATHERING_TYPE_OPTIONS = [
  ALL_GATHERING_TYPES,
  'Worship & service',
  'Fellowship & meals',
  'Kids & family',
  'Youth',
  'Small groups',
  'Music',
  'Outreach',
  'Other',
] as const;

export const AUDIENCE_OPTIONS = [EVERYONE_AUDIENCE, 'Men', 'Women'] as const;

export const AGES_OPTIONS = [ALL_AGES, 'Kids & family', 'Youth', 'Adults (18+)'] as const;

const TYPE_SLUG_BY_LABEL: Record<string, string> = {
  'Worship & service': 'worship_service',
  'Fellowship & meals': 'fellowship_meals',
  'Kids & family': 'kids_family',
  Youth: 'youth',
  'Small groups': 'small_groups',
  Music: 'music',
  Outreach: 'outreach',
  Other: 'other',
};

const TYPE_SLUGS = new Set(Object.values(TYPE_SLUG_BY_LABEL));
const AUDIENCE_SLUGS = new Set(['men', 'women']);
const AGES_SLUGS = new Set(['kids_family', 'youth', 'adults']);

const AGES_SLUG_BY_LABEL: Record<string, string> = {
  'Kids & family': 'kids_family',
  Youth: 'youth',
  'Adults (18+)': 'adults',
};

function typeParam(value: string | undefined): string | null {
  const text = value?.trim() ?? '';
  if (!text || text === ALL_GATHERING_TYPES) return null;
  if (TYPE_SLUG_BY_LABEL[text]) return TYPE_SLUG_BY_LABEL[text];
  if (TYPE_SLUGS.has(text)) return text;
  return null;
}

function audienceParam(value: string | undefined): string | null {
  const text = value?.trim() ?? '';
  if (!text || text === EVERYONE_AUDIENCE || text === 'everyone') return null;
  if (text === 'Men') return 'men';
  if (text === 'Women') return 'women';
  if (AUDIENCE_SLUGS.has(text)) return text;
  return null;
}

function agesParam(value: string | undefined): string | null {
  const text = value?.trim() ?? '';
  if (!text || text === ALL_AGES || text === 'all') return null;
  if (AGES_SLUG_BY_LABEL[text]) return AGES_SLUG_BY_LABEL[text];
  if (AGES_SLUGS.has(text)) return text;
  return null;
}

export function buildActivitySearchParams(filters: Partial<ActivityFilters>): string {
  const params = new URLSearchParams();

  const location = filters.location?.trim();
  if (location) {
    params.set('location', location);
  }

  if (filters.maxDistance && filters.maxDistance.length > 0) {
    const distance = filters.maxDistance[filters.maxDistance.length - 1];
    if (typeof distance === 'number' && Number.isFinite(distance)) {
      params.set('radius', String(distance));
    }
  }

  if (filters.dateFrom) {
    params.set('date_from', filters.dateFrom.toISOString());
  }

  if (filters.dateTo) {
    params.set('date_to', filters.dateTo.toISOString());
  }

  const type = typeParam(filters.gatheringType);
  if (type) params.set('type', type);

  const audience = audienceParam(filters.audience);
  if (audience) params.set('audience', audience);

  const ages = agesParam(filters.ages);
  if (ages) params.set('ages', ages);

  return params.toString();
}
