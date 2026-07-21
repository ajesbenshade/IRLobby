import { ImageSourcePropType } from 'react-native';

/**
 * Vibe Quiz illustrations - Electric Midnight premium aesthetic.
 * All images live in root /assets/brand/illustrations/vibe-quiz/
 */

export const VIBE_QUIZ_IMAGES = {
  intro: require('../../../../../../assets/brand/illustrations/vibe-quiz/optimized/vibe-quiz-intro-optimized.jpg') as ImageSourcePropType,

  cozy_night_owl: require('../../../../../../assets/brand/illustrations/vibe-quiz/optimized/cozy-night-owl-optimized.jpg') as ImageSourcePropType,
  hype_energy_host: require('../../../../../../assets/brand/illustrations/vibe-quiz/optimized/hype-energy-host-optimized.jpg') as ImageSourcePropType,
  creative_night_owl: require('../../../../../../assets/brand/illustrations/vibe-quiz/optimized/creative-night-owl-optimized.jpg') as ImageSourcePropType,
  deep_connector: require('../../../../../../assets/brand/illustrations/vibe-quiz/optimized/deep-connector-optimized.jpg') as ImageSourcePropType,
  adventure_seeker: require('../../../../../../assets/brand/illustrations/vibe-quiz/optimized/adventure-seeker-optimized.jpg') as ImageSourcePropType,
  wellness_wanderer: require('../../../../../../assets/brand/illustrations/vibe-quiz/optimized/wellness-wanderer-optimized.jpg') as ImageSourcePropType,
} as const;

export type VibeProfileKey = keyof Omit<typeof VIBE_QUIZ_IMAGES, 'intro'>;
