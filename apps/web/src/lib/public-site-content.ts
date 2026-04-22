export const publicNavLinks = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/features', label: 'Features' },
  { to: '/download', label: 'Download' },
  { to: '/support', label: 'Support' },
] as const;

export const homepageSteps = [
  {
    step: '1',
    title: 'Take the vibe quiz',
    description:
      'Five fast prompts tune your feed in about a minute. No cold-start paralysis, no giant preferences form.',
  },
  {
    step: '2',
    title: 'Swipe real activities',
    description:
      'Discover actual plans near you with timing, distance, and vibe tags up front. Swipe because the activity sounds fun.',
  },
  {
    step: '3',
    title: 'Match and actually meet',
    description:
      'Mutual interest unlocks chat instantly so you can coordinate the details and get out the door.',
  },
] as const;

export const homepageFeatureHighlights = [
  {
    title: 'Vibe quiz',
    emoji: '⚡',
    description: 'Five answers shape your discover feed and stay available offline.',
  },
  {
    title: 'Activity-first matching',
    emoji: '🎯',
    description: 'Swipe on plans, not just profiles. Rooftops, hikes, game nights, deep convos.',
  },
  {
    title: 'Real-time chat',
    emoji: '💬',
    description: 'Every match carries its activity context into chat so coordination is frictionless.',
  },
  {
    title: 'Hyper-local discovery',
    emoji: '📍',
    description: 'See things you can realistically get to, not generic events on the other side of town.',
  },
  {
    title: 'Offline resilience',
    emoji: '🛜',
    description: 'Recent quiz results and core state stay available through spotty connectivity.',
  },
  {
    title: 'Safety controls',
    emoji: '🛡️',
    description: 'Block and report tools exist wherever conversations and activities happen.',
  },
] as const;

export const featureCards = [
  {
    title: 'Vibe Quiz',
    emoji: '⚡',
    description:
      'Five swipeable cards in about 60 seconds. Your answers influence discovery immediately and stay cached for faster repeat visits.',
  },
  {
    title: 'Activity-first discover',
    emoji: '🎯',
    description:
      'Cards are real plans with timing, host context, distance, and tags. You are choosing what to do, not doom-scrolling people.',
  },
  {
    title: 'Match celebration',
    emoji: '🎉',
    description:
      'Mutual interest feels like progress. The product is tuned to move you from interest to coordination without losing momentum.',
  },
  {
    title: 'Real-time chat',
    emoji: '💬',
    description:
      'Match-backed messaging stays tied to the activity so the conversation knows what you are meeting for.',
  },
  {
    title: 'Hyper-local',
    emoji: '📍',
    description:
      'Distance-aware ranking keeps discovery realistic. You should see things you can join, not events that are technically nearby on paper.',
  },
  {
    title: 'Offline-ready',
    emoji: '🛜',
    description:
      'Key state survives rough connectivity so the app still feels responsive when location or signal is inconsistent.',
  },
  {
    title: 'Safety baked in',
    emoji: '🛡️',
    description:
      'Reporting, blocking, and moderation hooks are part of the product model instead of afterthoughts.',
  },
  {
    title: 'Dark-mode native',
    emoji: '🌗',
    description:
      'The brand and UI are designed for high-contrast night use, which matters when plans happen after work or late at night.',
  },
] as const;

export const howItWorksSteps = [
  {
    step: '1',
    label: 'Vibe Quiz',
    title: 'Tell IRLobby your vibe in about a minute.',
    description:
      'Five quick cards replace a giant onboarding form. You can skip, revisit, and retune the signal later without starting over.',
    bullets: ['Swipeable onboarding instead of a survey', 'Stored for repeat use', 'Designed to reduce cold-start friction'],
    emoji: '⚡',
  },
  {
    step: '2',
    label: 'Discover',
    title: 'Swipe on plans, not selfies.',
    description:
      'Every card is a real activity with time, place, and host context. You can filter what shows up and host your own activity when nothing fits.',
    bullets: ['Distance and timing context up front', 'Tags for quick vibe scanning', 'Fast path to hosting your own event'],
    emoji: '🎯',
  },
  {
    step: '3',
    label: 'Match & Meet',
    title: 'Mutual interest unlocks chat instantly.',
    description:
      'You do not need to force small talk before there is a reason to talk. Chat opens once the activity interest is mutual.',
    bullets: ['Real-time messaging', 'Activity context persists into chat', 'Safety actions remain close at hand'],
    emoji: '🎉',
  },
] as const;

export const supportFaqs = [
  {
    question: "I didn't get a verification email.",
    answer:
      'Check spam or junk first, then re-request from sign in and confirm the address was typed correctly. If it still does not arrive, email support.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'In the app: Profile, then Settings, then Delete account. That permanently removes your profile, matches, messages, and quiz results.',
  },
  {
    question: 'No activities are showing up.',
    answer:
      'Make sure location access is enabled, then widen your distance filter. If your area is quiet, creating an activity is often the fastest way to get momentum going.',
  },
  {
    question: 'How do I report a person or activity?',
    answer:
      'Use the overflow menu from a profile, activity, or chat thread. You can block, report, or do both depending on the situation.',
  },
  {
    question: 'Can I use IRLobby without sharing my location?',
    answer:
      'You can, but discovery quality drops sharply because nearby context is core to matching and ranking activities.',
  },
  {
    question: 'When is Android coming?',
    answer:
      'Android is on the roadmap. Join the waitlist via hello@irlobby.com and you will get an update when the public build is ready.',
  },
] as const;

export const footerLinks = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/features', label: 'Features' },
  { to: '/download', label: 'Download' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
  { to: '/support', label: 'Support' },
] as const;
