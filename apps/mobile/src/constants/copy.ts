import { DELETE_ACCOUNT_COPY } from './foyerCopy';
/**
 * Centralized user-facing strings for the mobile app.
 *
 * Voice & tone: short, confident, warm, low-friction. Pair with The Foyer
 * and Franconia Mennonite Church. Keep new strings under ~10 words for
 * headlines and ~18 for subtitles.
 *
 * Add new strings here rather than inline so future copy passes (and
 * eventual i18n) stay easy.
 */

import { brand } from '@theme/index';

export const tagline = brand.tagline;

export const auth = {
  login: {
    eyebrow: brand.name,
    title: 'Login',
    subtitle: 'Gatherings at Franconia Mennonite Church.',
    pillText: 'Real plans, real fast',
    primaryCta: 'Continue with email',
    twitterCta: 'Continue with X',
    googleCta: 'Continue with Google',
    appleCta: 'Continue with Apple',
    googleNotConfigured:
      'Google sign-in is not configured on this build yet.',
    emailPlaceholder: 'Email',
    passwordPlaceholder: 'Password',
    orDivider: 'or',
    forgotPassword: 'Forgot password?',
    footerPrompt: 'New here?',
    footerCta: 'Create account',
    legalPrefix: 'By continuing you agree to the',
    legalTerms: 'Terms',
    legalAnd: ' and ',
    legalPrivacy: 'Privacy Policy',
    legalSuffix: '.',
    twitterProgressTitle: 'X/Twitter auth in progress',
    twitterProgressBody: 'Hang tight while we connect you through X...',
    twitterProgressNote: 'Redirects via api.irlobby.com then back to the app',
    emailRequired: 'Enter your email address to continue.',
    passwordRequired: 'Enter your password to continue.',
    fallbackError: 'Unable to sign in. Please try again.',
    signInToastTitle: "Couldn't finish sign-in.",
    signInToastBody: 'Try again.',
    signInToastAction: 'Try again',
  },
  register: {
    eyebrow: brand.name,
    title: "Let's get you in.",
    subtitle: 'Two minutes. Then you’re out the door.',
    primaryCta: 'Create account',
    twitterCta: 'Continue with X',
    googleCta: 'Continue with Google',
    appleCta: 'Continue with Apple',
    googleNotConfigured:
      'Google sign-in is not configured on this build yet.',
    legalLabel:
      'By continuing you agree to the Terms and Privacy Policy.',
    legalPrefix: 'By continuing you agree to the',
    legalTerms: 'Terms',
    legalAnd: ' and ',
    legalPrivacy: 'Privacy Policy',
    legalSuffix: '.',
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
  Activity: 'Gatherings',
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

export const account = {
  settingsRowTitle: 'Account',
  settingsRowSubtitle: DELETE_ACCOUNT_COPY.rowSubtitle,
  screenEyebrow: 'Account',
  screenTitle: 'Account',
  screenSubtitle: 'Permanent delete only. This cannot be undone.',
  deleteCta: 'Delete account',
  confirmTitle: 'Delete your account?',
  confirmBody: DELETE_ACCOUNT_COPY.confirmBody,
  retention: DELETE_ACCOUNT_COPY.retention,
  cardSubtitle: DELETE_ACCOUNT_COPY.cardSubtitle,
  confirmPrimary: 'Delete account',
  confirmCancel: 'Cancel',
  deletedTitle: 'Account deleted',
  deletedBody: 'Your account on The Foyer is gone. You’re signed out.',
  backToWelcome: 'Back to welcome',
  deleteError: 'Unable to delete your account.',
};
