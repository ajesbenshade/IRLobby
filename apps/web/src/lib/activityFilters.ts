import type { ActivityFilters } from '@/types/activity';

/**
 * Query string for GET /api/activities/.
 * LIVE list filters that already work: location, radius, date_from, date_to.
 * Type, Audience, and Ages stay off this request until Backend adds church
 * category slugs, audience=, and ages=. Never send price_min, price_max,
 * skill_level, tags, or age_restriction.
 */
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

  return params.toString();
}
