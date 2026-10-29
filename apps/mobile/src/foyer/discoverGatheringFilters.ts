/**
 * Church gathering filters for the Foyer Discover sheet.
 * Slugs match irlobby_backend/activities/discover_filters.py.
 * Empty value is the Design default and is omitted from the query.
 */

export type GatheringChoice = {
  label: string;
  value: string;
};

export const GATHERING_TYPE_CHOICES: readonly GatheringChoice[] = [
  { label: 'All types', value: '' },
  { label: 'Worship & service', value: 'worship_service' },
  { label: 'Fellowship & meals', value: 'fellowship_meals' },
  { label: 'Kids & family', value: 'kids_family' },
  { label: 'Youth', value: 'youth' },
  { label: 'Small groups', value: 'small_groups' },
  { label: 'Music', value: 'music' },
  { label: 'Outreach', value: 'outreach' },
  { label: 'Other', value: 'other' },
];

export const AUDIENCE_CHOICES: readonly GatheringChoice[] = [
  { label: 'Everyone', value: '' },
  { label: 'Men', value: 'men' },
  { label: 'Women', value: 'women' },
];

export const AGES_CHOICES: readonly GatheringChoice[] = [
  { label: 'All ages', value: '' },
  { label: 'Kids & family', value: 'kids_family' },
  { label: 'Youth', value: 'youth' },
  { label: 'Adults (18+)', value: 'adults' },
];

const TYPE_SLUGS = new Set(
  GATHERING_TYPE_CHOICES.map((choice) => choice.value).filter((value) => value.length > 0),
);
const AUDIENCE_SLUGS = new Set(['men', 'women']);
const AGES_SLUGS = new Set(['kids_family', 'youth', 'adults']);

function knownSlug(value: string, allowed: Set<string>): string | undefined {
  const text = value.trim();
  return allowed.has(text) ? text : undefined;
}

/** Query fields for GET /api/activities/. Defaults and unknown values are omitted. */
export function foyerGatheringQuery(input: {
  gatheringType: string;
  audience: string;
  ages: string;
  dateFrom?: string;
  dateTo?: string;
}): {
  type?: string;
  audience?: string;
  ages?: string;
  date_from?: string;
  date_to?: string;
} {
  const type = knownSlug(input.gatheringType, TYPE_SLUGS);
  const audience = knownSlug(input.audience, AUDIENCE_SLUGS);
  const ages = knownSlug(input.ages, AGES_SLUGS);
  return {
    ...(type ? { type } : {}),
    ...(audience ? { audience } : {}),
    ...(ages ? { ages } : {}),
    ...(input.dateFrom ? { date_from: input.dateFrom } : {}),
    ...(input.dateTo ? { date_to: input.dateTo } : {}),
  };
}
