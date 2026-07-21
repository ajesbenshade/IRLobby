import {
  VIBE_TAG_TO_DISCOVER,
  type VibeAnswers,
  type VibeProfile,
  type VibeQuizResult,
  type VibeTag,
} from '@shared/schema';

// Q1 — energy / vibe of a perfect night out
export type Q1Option = 'low_key' | 'big_group_chaos' | 'deep_chill' | 'high_energy' | 'active_adventure';

// Q2 — recharge style
export type Q2Option = 'solo_creative' | 'small_circle' | 'meet_new' | 'big_familiar_party' | 'nature_quiet';

// Q4 — dream hangout spot
export type Q4Option = 'cozy_basement' | 'rooftop_city' | 'underground_warehouse' | 'sunny_park' | 'aesthetic_cafe';

// Q5 — desired post-hang feeling
export type Q5Option = 'laughing_hard' | 'inspired_creative' | 'calm_recharged' | 'deeply_connected' | 'proud_brave';

interface Score {
  cozy_night_owl: number;
  hype_energy_host: number;
  creative_night_owl: number;
  deep_connector: number;
  adventure_seeker: number;
  wellness_wanderer: number;
}

const emptyScore = (): Score => ({
  cozy_night_owl: 0,
  hype_energy_host: 0,
  creative_night_owl: 0,
  deep_connector: 0,
  adventure_seeker: 0,
  wellness_wanderer: 0,
});

const Q1_WEIGHTS: Record<Q1Option, Partial<Score>> = {
  low_key: { cozy_night_owl: 3, deep_connector: 1 },
  big_group_chaos: { hype_energy_host: 3 },
  deep_chill: { deep_connector: 3, cozy_night_owl: 1 },
  high_energy: { hype_energy_host: 3, creative_night_owl: 1 },
  active_adventure: { adventure_seeker: 3, wellness_wanderer: 1 },
};

const Q2_WEIGHTS: Record<Q2Option, Partial<Score>> = {
  solo_creative: { creative_night_owl: 3, wellness_wanderer: 1 },
  small_circle: { deep_connector: 2, cozy_night_owl: 2 },
  meet_new: { hype_energy_host: 2, adventure_seeker: 1 },
  big_familiar_party: { hype_energy_host: 3 },
  nature_quiet: { wellness_wanderer: 3, adventure_seeker: 1 },
};

const Q3_TAG_WEIGHTS: Record<VibeTag, Partial<Score>> = {
  board_games: { cozy_night_owl: 2, deep_connector: 1 },
  live_music: { hype_energy_host: 2, creative_night_owl: 1 },
  cooking: { cozy_night_owl: 1, deep_connector: 1, creative_night_owl: 1 },
  outdoors: { adventure_seeker: 2, wellness_wanderer: 1 },
  art: { creative_night_owl: 2 },
  wellness: { wellness_wanderer: 2 },
  deep_talks: { deep_connector: 2, cozy_night_owl: 1 },
  sports: { adventure_seeker: 2, hype_energy_host: 1 },
};

const Q4_WEIGHTS: Record<Q4Option, Partial<Score>> = {
  cozy_basement: { cozy_night_owl: 3, creative_night_owl: 1 },
  rooftop_city: { hype_energy_host: 2, creative_night_owl: 1 },
  underground_warehouse: { hype_energy_host: 3 },
  sunny_park: { adventure_seeker: 2, wellness_wanderer: 2 },
  aesthetic_cafe: { creative_night_owl: 2, deep_connector: 1, wellness_wanderer: 1 },
};

const Q5_WEIGHTS: Record<Q5Option, Partial<Score>> = {
  laughing_hard: { hype_energy_host: 2, cozy_night_owl: 1 },
  inspired_creative: { creative_night_owl: 3 },
  calm_recharged: { wellness_wanderer: 3, cozy_night_owl: 1 },
  deeply_connected: { deep_connector: 3 },
  proud_brave: { adventure_seeker: 3 },
};

const addWeights = (score: Score, weights: Partial<Score> | undefined) => {
  if (!weights) return;
  for (const key of Object.keys(weights) as (keyof Score)[]) {
    score[key] += weights[key] ?? 0;
  }
};

const PROFILE_PRIORITY: VibeProfile[] = [
  'creative_night_owl',
  'deep_connector',
  'adventure_seeker',
  'hype_energy_host',
  'cozy_night_owl',
  'wellness_wanderer',
];

const pickProfile = (score: Score): VibeProfile => {
  let best: VibeProfile = 'cozy_night_owl';
  let bestValue = -Infinity;
  for (const profile of PROFILE_PRIORITY) {
    const value = score[profile];
    if (value > bestValue) {
      bestValue = value;
      best = profile;
    }
  }
  return best;
};

const PROFILE_DEFAULT_TAGS: Record<VibeProfile, VibeTag[]> = {
  cozy_night_owl: ['board_games', 'cooking', 'deep_talks'],
  hype_energy_host: ['live_music', 'sports'],
  creative_night_owl: ['art', 'live_music'],
  deep_connector: ['deep_talks', 'cooking'],
  adventure_seeker: ['outdoors', 'sports'],
  wellness_wanderer: ['wellness', 'outdoors'],
};

export const MAX_Q3_SELECTIONS = 3;

export const scoreVibe = (answers: VibeAnswers): VibeQuizResult => {
  const score = emptyScore();

  addWeights(score, Q1_WEIGHTS[answers.q1 as Q1Option]);
  addWeights(score, Q2_WEIGHTS[answers.q2 as Q2Option]);
  addWeights(score, Q4_WEIGHTS[answers.q4 as Q4Option]);
  addWeights(score, Q5_WEIGHTS[answers.q5 as Q5Option]);

  const cappedTags = (answers.q3 ?? []).slice(0, MAX_Q3_SELECTIONS);
  for (const tag of cappedTags) {
    addWeights(score, Q3_TAG_WEIGHTS[tag]);
  }

  const vibeProfile = pickProfile(score);
  const vibeTags = cappedTags.length ? cappedTags : PROFILE_DEFAULT_TAGS[vibeProfile];
  const discoverTags = vibeTags.map((tag) => VIBE_TAG_TO_DISCOVER[tag]);

  return {
    vibeProfile,
    vibeTags,
    discoverTags,
    answers: { ...answers, q3: cappedTags },
    completedAt: new Date().toISOString(),
  };
};

export const deriveLegacyInterests = (result: VibeQuizResult): string[] => result.discoverTags.slice(0, 20);

export const deriveLegacyActivityPreferences = (
  result: VibeQuizResult,
  existing: Record<string, unknown> | undefined = {},
): Record<string, unknown> => {
  const outdoor =
    result.vibeTags.includes('outdoors') ||
    result.vibeTags.includes('sports') ||
    result.answers.q1 === 'active_adventure' ||
    result.answers.q4 === 'sunny_park';
  const indoor =
    result.vibeTags.includes('board_games') ||
    result.vibeTags.includes('art') ||
    result.vibeTags.includes('cooking') ||
    result.answers.q4 === 'cozy_basement' ||
    result.answers.q4 === 'aesthetic_cafe';
  const smallGroups =
    result.answers.q1 === 'low_key' ||
    result.answers.q1 === 'deep_chill' ||
    result.answers.q2 === 'small_circle' ||
    result.answers.q2 === 'solo_creative';
  const weekendPreferred =
    result.answers.q1 === 'big_group_chaos' || result.answers.q1 === 'high_energy';

  return {
    ...existing,
    indoor: indoor || Boolean(existing.indoor),
    outdoor: outdoor || Boolean(existing.outdoor),
    smallGroups: smallGroups || Boolean(existing.smallGroups),
    weekendPreferred: weekendPreferred || Boolean(existing.weekendPreferred),
    vibe: {
      vibeProfile: result.vibeProfile,
      vibeTags: result.vibeTags,
      vibeDiscoverTags: result.discoverTags,
      vibeAnswers: result.answers,
      vibeCompletedAt: result.completedAt,
      vibeQuizSkipped: false,
    },
  };
};
