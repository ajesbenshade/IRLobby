/**
 * Centralized user-facing strings for the mobile app.
 *
 * Voice & tone: short, confident, warm, low-friction. Pair with the brand
 * tagline "Get out. Get together." Keep new strings under ~10 words for
 * headlines and ~18 for subtitles.
 *
 * Add new strings here rather than inline so future copy passes (and
 * eventual i18n) stay easy.
 */

import { brand } from '@theme/index';

export const tagline = brand.tagline; // "Get out. Get together."

export const auth = {
  login: {
    eyebrow: brand.name,
    title: 'Welcome back.',
    subtitle: tagline,
    pillText: 'Real plans, real fast',
    primaryCta: 'Sign in',
    twitterCta: 'Continue with X',
    forgotPassword: 'Forgot password?',
    footerPrompt: 'New here?',
    footerCta: 'Create account',
    fallbackError: 'Unable to sign in. Please try again.',
  },
  register: {
    eyebrow: brand.name,
    title: "Let's get you in.",
    subtitle: 'Two minutes. Then you’re out the door.',
    primaryCta: 'Create account',
    legalLabel:
      'I agree to the Terms of Service and Privacy Policy.',
    legalRequired: 'Please accept the terms to continue.',
    footerPrompt: 'Already have an account?',
    footerCta: 'Sign in',
    fallbackError: 'Unable to create your account. Please try again.',
  },
  forgot: {
    eyebrow: brand.name,
    title: 'Reset your password',
    subtitle: 'We’ll email you a link.',
    primaryCta: 'Send reset link',
  },
};

export const tabs = {
  Discover: 'Discover',
  Activity: 'Events',
  Create: 'Host',
  Chat: 'Chat',
  Profile: 'Profile',
} as const;

export const home = {
  eyebrow: 'Tonight',
  greeting: (name: string) => `Hey ${name}.`,
  greetingPrompt: 'What are you up to tonight?',
  hostingLabel: 'Hosting',
  hostingDetail: 'Plans you’re running.',
  openLabel: 'Nearby',
  openDetail: 'Open plans you can jump into.',
  ctaTitle: 'Turn scrolling into a plan.',
  ctaSubtitle: 'Host something or hop into the deck.',
  hostCta: 'Host something',
  exploreCta: 'Explore plans',
  latestTitle: 'Your latest plans',
  latestMeta: 'What you’re hosting right now.',
  emptyTitle: 'No plans yet',
  emptyDescription: 'Post your first hang and people can join.',
  emptyCta: 'Host your first plan',
  loadError: 'Couldn’t load your home feed.',
};

export const discover = {
  eyebrow: 'Discover',
  title: 'Happening near you',
  subtitle: 'Swipe to join. Pass to skip.',
};

export const chat = {
  eyebrow: 'Chat',
  title: 'Your conversations',
  subtitle: 'New matches and active chats live here.',
  countLabel: (n: number) => `${n} active`,
  loading: 'Loading your chats…',
  emptyTitle: 'No chats yet',
  emptyDescription: 'Match with someone or join a plan to start chatting.',
};

export const profile = {
  eyebrow: 'Profile',
  subtitle: 'How you show up across plans and chats.',
};

export const onboarding = {
  // Phase 4 wires the new 3-step flow to these strings.
  step1: {
    title: 'Add a photo + your name',
    subtitle: 'Show up as you. Real photo, first name.',
    nameLabel: 'First name',
    photoCta: 'Add photo',
    nextCta: 'Next',
  },
  step2: {
    title: 'Pick your vibe',
    subtitle: 'What are you up for? Pick a few.',
    skip: 'Skip for now',
    nextCta: 'Next',
  },
  step3: {
    title: 'Find plans nearby',
    subtitle: 'Share location and notifications so you don’t miss a thing.',
    locationCta: 'Allow location',
    notificationsCta: 'Allow notifications',
    finishCta: "You're in",
    skip: 'Maybe later',
  },
  completeYourProfile: 'Complete your profile',
};

export const empty = {
  generic: {
    title: 'Nothing here yet',
    description: 'Check back soon.',
  },
};

export const store = {
  shortDescription: tagline,
  description:
    `${brand.name} — ${tagline} Find real plans nearby, host your own, and turn scrolling into a night out.`,
};
