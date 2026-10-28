export const publicNavLinks = [{ to: '/support', label: 'Support' }] as const;

export const supportFaqs = [
  {
    question: "I didn't get a verification email.",
    answer:
      'Check spam or junk first, then re-request from sign in and confirm the address was typed correctly. If it still does not arrive, email support.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'In the app: Profile, then Settings, then Delete account. That permanently removes your profile, RSVPs, and messages.',
  },
  {
    question: 'No gatherings are showing up.',
    answer:
      'Make sure location access is enabled, then widen your distance filter. If your area is quiet, hosting a gathering is often the fastest way to get things started.',
  },
  {
    question: 'How do I export a copy of my data?',
    answer:
      'In the app: Settings, then export. That downloads a JSON copy of your profile, gatherings, RSVPs, and reviews. You can also email support@irlobby.com.',
  },
  {
    question: 'How do I report a person or activity?',
    answer:
      'Use the overflow menu from a profile, gathering, or chat thread. You can block, report, or do both depending on the situation.',
  },
  {
    question: 'Can I use The Foyer without sharing my location?',
    answer:
      'You can, but discovery quality drops sharply because nearby context helps rank upcoming gatherings.',
  },
  {
    question: 'When is Android coming?',
    answer:
      'Android is on the roadmap. Join the waitlist via hello@irlobby.com and you will get an update when the public build is ready.',
  },
] as const;

export const footerLinks = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
  { to: '/support', label: 'Support' },
] as const;
