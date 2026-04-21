import { describe, expect, it } from '@jest/globals';

import {
  MAX_Q3_SELECTIONS,
  deriveLegacyActivityPreferences,
  deriveLegacyInterests,
  scoreVibe,
} from '../vibeScoring';

describe('scoreVibe', () => {
  it('maps low-key + small circle + cozy basement to cozy_night_owl', () => {
    const result = scoreVibe({
      q1: 'low_key',
      q2: 'small_circle',
      q3: ['board_games', 'cooking'],
      q4: 'cozy_basement',
      q5: 'laughing_hard',
    });
    expect(result.vibeProfile).toBe('cozy_night_owl');
    expect(result.vibeTags).toEqual(['board_games', 'cooking']);
    expect(result.discoverTags).toEqual(['board games', 'cooking']);
  });

  it('maps high energy + big party + warehouse to hype_energy_host', () => {
    const result = scoreVibe({
      q1: 'high_energy',
      q2: 'big_familiar_party',
      q3: ['live_music', 'sports'],
      q4: 'underground_warehouse',
      q5: 'laughing_hard',
    });
    expect(result.vibeProfile).toBe('hype_energy_host');
  });

  it('maps solo creative + art + cafe + inspired to creative_night_owl', () => {
    const result = scoreVibe({
      q1: 'low_key',
      q2: 'solo_creative',
      q3: ['art', 'live_music'],
      q4: 'aesthetic_cafe',
      q5: 'inspired_creative',
    });
    expect(result.vibeProfile).toBe('creative_night_owl');
  });

  it('maps deep chill + small circle + deep talks to deep_connector', () => {
    const result = scoreVibe({
      q1: 'deep_chill',
      q2: 'small_circle',
      q3: ['deep_talks', 'cooking'],
      q4: 'cozy_basement',
      q5: 'deeply_connected',
    });
    expect(result.vibeProfile).toBe('deep_connector');
  });

  it('maps active adventure + nature + outdoors + proud to adventure_seeker', () => {
    const result = scoreVibe({
      q1: 'active_adventure',
      q2: 'nature_quiet',
      q3: ['outdoors', 'sports'],
      q4: 'sunny_park',
      q5: 'proud_brave',
    });
    expect(result.vibeProfile).toBe('adventure_seeker');
  });

  it('maps nature quiet + wellness + calm to wellness_wanderer', () => {
    const result = scoreVibe({
      q1: 'active_adventure',
      q2: 'nature_quiet',
      q3: ['wellness', 'outdoors'],
      q4: 'sunny_park',
      q5: 'calm_recharged',
    });
    expect(result.vibeProfile).toBe('wellness_wanderer');
  });

  it('caps q3 selections at MAX_Q3_SELECTIONS', () => {
    const result = scoreVibe({
      q1: 'low_key',
      q2: 'small_circle',
      q3: ['board_games', 'cooking', 'art', 'sports'],
      q4: 'cozy_basement',
      q5: 'laughing_hard',
    });
    expect(result.vibeTags).toHaveLength(MAX_Q3_SELECTIONS);
    expect(result.answers.q3).toHaveLength(MAX_Q3_SELECTIONS);
  });

  it('falls back to default tags when q3 is empty', () => {
    const result = scoreVibe({
      q1: 'high_energy',
      q2: 'big_familiar_party',
      q3: [],
      q4: 'underground_warehouse',
      q5: 'laughing_hard',
    });
    expect(result.vibeTags.length).toBeGreaterThan(0);
    expect(result.discoverTags.length).toBeGreaterThan(0);
  });
});

describe('deriveLegacy helpers', () => {
  it('produces non-empty interests for the legacy onboarding payload', () => {
    const result = scoreVibe({
      q1: 'low_key',
      q2: 'small_circle',
      q3: ['board_games', 'cooking'],
      q4: 'cozy_basement',
      q5: 'laughing_hard',
    });
    expect(deriveLegacyInterests(result)).toEqual(['board games', 'cooking']);
  });

  it('preserves existing activity preferences and adds the vibe payload', () => {
    const result = scoreVibe({
      q1: 'active_adventure',
      q2: 'nature_quiet',
      q3: ['outdoors'],
      q4: 'sunny_park',
      q5: 'proud_brave',
    });
    const merged = deriveLegacyActivityPreferences(result, { weekendPreferred: true });
    expect(merged.outdoor).toBe(true);
    expect(merged.weekendPreferred).toBe(true);
    expect((merged.vibe as Record<string, unknown>).vibeProfile).toBe('adventure_seeker');
  });
});
