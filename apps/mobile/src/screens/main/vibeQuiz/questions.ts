import type { VibeTag } from '@shared/schema';

export type QuestionId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5';

export interface VibeQuestionOption {
  value: string;
  emoji: string;
  label: string;
  helper?: string;
}

export interface VibeQuestion {
  id: QuestionId;
  prompt: string;
  helper: string;
  multiSelect: boolean;
  maxSelections?: number;
  options: VibeQuestionOption[];
}

export const VIBE_QUESTIONS: VibeQuestion[] = [
  {
    id: 'q1',
    prompt: 'How do you usually feel on a perfect night out?',
    helper: 'Pick the one that feels most like you right now.',
    multiSelect: false,
    options: [
      { value: 'low_key', emoji: '🧘', label: 'Low-key & cozy', helper: '1–4 people' },
      { value: 'big_group_chaos', emoji: '🎉', label: 'Big group chaos & laughter' },
      { value: 'deep_chill', emoji: '🌙', label: 'Chill but deep conversations' },
      { value: 'high_energy', emoji: '⚡', label: 'High-energy dancing & music' },
      { value: 'active_adventure', emoji: '🏔️', label: 'Active & adventurous' },
    ],
  },
  {
    id: 'q2',
    prompt: 'After a long week, you recharge by…',
    helper: 'Single select.',
    multiSelect: false,
    options: [
      { value: 'solo_creative', emoji: '🎨', label: 'Solo creative time' },
      { value: 'small_circle', emoji: '🫶', label: 'Small trusted circle' },
      { value: 'meet_new', emoji: '✨', label: 'Meeting new people' },
      { value: 'big_familiar_party', emoji: '🥳', label: 'Big party with familiar faces' },
      { value: 'nature_quiet', emoji: '🌿', label: 'Quiet nature escape' },
    ],
  },
  {
    id: 'q3',
    prompt: 'Pick up to 3 activities that make you say “I’m so down”',
    helper: 'Multi-select. Up to 3.',
    multiSelect: true,
    maxSelections: 3,
    options: [
      { value: 'board_games', emoji: '🎲', label: 'Board games & trivia' },
      { value: 'live_music', emoji: '🎤', label: 'Live music & dancing' },
      { value: 'cooking', emoji: '🍜', label: 'Cooking & feasting' },
      { value: 'outdoors', emoji: '🥾', label: 'Outdoor adventures' },
      { value: 'art', emoji: '🎨', label: 'Art & making stuff' },
      { value: 'wellness', emoji: '🧘', label: 'Wellness & movement' },
      { value: 'deep_talks', emoji: '💭', label: 'Deep talks & philosophy' },
      { value: 'sports', emoji: '⚽', label: 'Sports & games' },
    ],
  },
  {
    id: 'q4',
    prompt: 'Your dream hangout spot feels like…',
    helper: 'Single select.',
    multiSelect: false,
    options: [
      { value: 'cozy_basement', emoji: '🛋️', label: 'Cozy basement with fairy lights' },
      { value: 'rooftop_city', emoji: '🌆', label: 'Rooftop with city views' },
      { value: 'underground_warehouse', emoji: '🔊', label: 'Underground warehouse' },
      { value: 'sunny_park', emoji: '🌞', label: 'Sunny park picnic' },
      { value: 'aesthetic_cafe', emoji: '☕', label: 'Aesthetic café with plants' },
    ],
  },
  {
    id: 'q5',
    prompt: 'What do you want to feel after the hang?',
    helper: 'Single select.',
    multiSelect: false,
    options: [
      { value: 'laughing_hard', emoji: '😂', label: 'Laughing so hard it hurts' },
      { value: 'inspired_creative', emoji: '✨', label: 'Inspired & creative' },
      { value: 'calm_recharged', emoji: '🧘', label: 'Calm & recharged' },
      { value: 'deeply_connected', emoji: '❤️', label: 'Deeply connected' },
      { value: 'proud_brave', emoji: '🌟', label: 'Proud of trying something new' },
    ],
  },
];

export const Q3_OPTION_VALUES = VIBE_QUESTIONS[2].options.map((option) => option.value as VibeTag);
