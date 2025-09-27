import type { ActivityFilters } from '@/types/activity';

export function buildActivitySearchParams(filters: Partial<ActivityFilters>): string {
  const params = new URLSearchParams();

  if (filters.category && filters.category !== 'All Categories') {
    params.set('category', filters.category);
  }

  if (filters.maxDistance && filters.maxDistance.length > 0) {
    const distance = filters.maxDistance[filters.maxDistance.length - 1];
    params.set('radius', String(distance));
  }

  if (filters.priceRange && filters.priceRange.length === 2) {
    params.set('price_min', String(filters.priceRange[0]));
    params.set('price_max', String(filters.priceRange[1]));
  }

  if (filters.dateFrom) {
    params.set('date_from', filters.dateFrom.toISOString());
  }

  if (filters.dateTo) {
    params.set('date_to', filters.dateTo.toISOString());
  }

  if (filters.skillLevel && filters.skillLevel !== 'All Levels') {
    params.set('skill_level', filters.skillLevel);
  }

  if (filters.ageRestriction && filters.ageRestriction !== 'All Ages') {
    params.set('age_restriction', filters.ageRestriction);
  }

  if (filters.tags && filters.tags.length > 0) {
    params.set('tags', filters.tags.join(','));
  }

  if (filters.location) {
    params.set('location', filters.location);
  }

  return params.toString();
}
