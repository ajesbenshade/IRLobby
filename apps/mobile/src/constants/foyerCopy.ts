/**
 * Every user-facing string for the Oct 1 Foyer screens, in one place.
 * Source: FOYER_DESIGN_SPEC.md "Final copy (Oct 1 late)" and the Frames 15-33 sections.
 * Wording may still change, so screens import from here and never hard-code these.
 */

export const COMMON_COPY = {
  cancel: 'Cancel',
  done: 'Done',
  save: 'Save',
  back: 'Back',
  retry: 'Retry',
  tryAgain: 'Try again',
  notNow: 'Not now',
  openSettings: 'Open Settings',
  genericError: 'Something went wrong. Please try again.',
  offline: "You're offline. Check your connection and try again.",
  unavailable: "This isn't available yet. Please try again later.",
} as const;

export const PHOTO_COPY = {
  uploadTitle: 'Add photos',
  uploadNotice: 'Photos you add can be viewed and saved by everyone who was at this gathering.',
  uploadCta: 'Add photos',
  uploadCountLabel: (count: number) => (count === 1 ? '1 photo' : `${count} photos`),
  eventPhotosHelper: 'Up to 50 photos · JPEG/PNG/WebP',
  atLimit: (max: number) => `This gathering already has ${max} photos.`,
  addOnlyGoing: 'Photos can be added by the host and people who are going.',
  galleryTitle: (count: number) => `Photos · ${count}`,
  downloadAll: 'Download all',
  downloadSelected: (count: number) => `Download ${count}`,
  viewerPosition: (index: number, total: number) => `${index} of ${total}`,
  saveToPhotos: 'Save to Photos',
  progressTitle: (done: number, total: number) => `Saving ${done} of ${total}…`,
  progressHelper: 'Saving one at a time. Please keep The Foyer open.',
  savedToast: (count: number) =>
    count === 1 ? 'Saved 1 photo to your library' : `Saved ${count} photos to your library`,
  cancelledToast: (saved: number, total: number) =>
    `Download cancelled. ${saved} of ${total} photos were saved.`,
  partialToast: (saved: number, total: number) =>
    `Saved ${saved} of ${total} photos. ${total - saved} couldn't be saved.`,
  failedAll: "Photos couldn't be saved. Please try again.",
  iosAddUsage: 'Save event photos to your library.',
  deniedTitle: 'Allow photo access to save photos',
  deniedBody:
    'The Foyer needs permission to add photos to your library. In Settings, tap Photos and choose Add Photos Only.',
  select: 'Select',
} as const;

export const FRIEND_COPY = {
  title: 'Friends',
  backToProfile: 'Profile',
  friendsTab: (count: number) => `Friends (${count})`,
  requestsTab: (count: number) => `Requests (${count})`,
  searchPlaceholder: 'Search friends',
  emptyFriendsTitle: 'No friends yet',
  emptyFriendsBody: 'When you add friends from a gathering, they will show up here.',
  emptyRequestsTitle: 'No friend requests',
  emptyRequestsBody: "When someone sends you a request, you'll see it here.",
  received: (count: number) => `RECEIVED · ${count}`,
  sent: (count: number) => `SENT · ${count}`,
  wantsToBeFriends: (name: string) => `${name} wants to be friends`,
  accept: 'Accept',
  decline: 'Decline',
  requestSent: 'Request sent',
  cancelRequest: 'Cancel request',
  keepRequest: 'Keep request',
  requestsFooter:
    "If you decline, they won't be told. You can cancel a request any time before it's answered.",
  addFriend: 'Add friend',
  message: 'Message',
  friendsCheck: 'Friends ✓',
  removeFriend: 'Remove friend',
  removeTitle: (name: string) => `Remove ${name}?`,
  removeBody:
    "You'll no longer be able to message each other. You can send a new friend request later.",
  messagingNote: "You can message each other once you're friends.",
  cancelRequestTitle: 'Cancel friend request?',
  cancelRequestBody: (name: string) => `${name} won't be told. You can send a new request later.`,
  profileRowCount: (count: number) => (count === 1 ? '1 friend' : `${count} friends`),
} as const;

export const MEMBER_COPY = {
  about: 'ABOUT',
  contact: 'CONTACT',
  phone: 'Phone',
  email: 'Email',
  reportOrBlock: 'Report or block',
  report: 'Report',
  block: 'Block',
  reportSub: 'Tell the church admins',
  blockSub: "You won't see each other",
  blockedTitle: "You can't view this person",
  blockedHelper: "Their profile isn't available to you.",
  unavailable: 'This profile is not available.',
  loadError: "This profile couldn't be loaded.",
  requestError: "Your request couldn't be sent. Please try again.",
  privacyExplanation: (name: string, contact: 'phone' | 'email' | 'both' | null) =>
    `${name}'s privacy settings let you see their profile.${contactSentence(contact)}`,
  friendExplanation: (name: string, contact: 'phone' | 'email' | 'both' | null) =>
    `You can see ${name}'s profile because you're friends.${contactSentence(contact)}`,
  blockTitle: (name: string) => `Block ${name}?`,
  blockLead: (name: string) => `If you block ${name}:`,
  blockBullets: (name: string) => [
    "You won't see each other's profiles or messages.",
    "Any friend request between you is cancelled. If you're friends, you won't be anymore.",
    `${name} won't be told.`,
    'You can unblock them any time in Profile > Messaging > Blocked people.',
  ],
  reportTitle: (name: string) => `Report ${name}`,
  reportLead: (name: string) => `Tell the church admins what's wrong. ${name} won't be told.`,
  reportReasons: [
    { value: 'spam', label: 'Spam or a fake account' },
    { value: 'harassment', label: 'Harassment or bullying' },
    { value: 'inappropriate', label: 'Inappropriate photo or message' },
    { value: 'fake_profile', label: 'Pretending to be someone else' },
    { value: 'other', label: 'Something else' },
  ] as const,
  reportDetails: 'Add details (optional)',
  submitReport: 'Submit report',
  reportSent: 'Report sent. Thank you.',
} as const;

function contactSentence(contact: 'phone' | 'email' | 'both' | null) {
  if (!contact) {
    return '';
  }
  const what =
    contact === 'phone' ? 'phone number' : contact === 'email' ? 'email address' : 'phone number and email address';
  return ` They chose to share their ${what}.`;
}

export const CHAT_COPY = {
  banner: 'Only friends can message you. Report or block anytime.',
  composerPlaceholder: 'Message',
  sendLabel: 'Send message',
  emptyTitle: 'No messages yet',
  emptyBody: (name: string) => `Say hello to ${name}. Only the two of you can see this chat.`,
  mutedHeader: (name: string) => `${name} · Muted`,
  mute: 'Mute conversation',
  unmute: 'Unmute conversation',
  muteSub: (name: string) => `Stop notifications from ${name}`,
  unmuteSub: (name: string) => `Get notifications from ${name} again`,
  leave: 'Leave conversation',
  leaveSub: 'Remove this chat from your list. You stay friends.',
  report: 'Report',
  reportSub: 'Tell the church admins.',
  block: 'Block',
  blockSub: "You won't see each other's profiles or messages.",
  muteTitle: (name: string) => `Mute ${name}?`,
  muteBody: "You won't get notifications from this chat. You can still read their messages.",
  muteCta: 'Mute',
  unmuteTitle: (name: string) => `Unmute ${name}?`,
  unmuteBody: "You'll get notifications from this chat again.",
  unmuteCta: 'Unmute',
  cannotSend: "You can't send messages in this chat.",
  loadError: "Messages couldn't be loaded.",
} as const;

export const GATHERING_CHAT_COPY = {
  title: 'Chat',
  banner: 'Only the host and people who are going can see this chat.',
  emptyTitle: 'No messages yet',
  emptyBody: 'Say hello. Chat starts once at least two people are going.',
  notEnough: 'Chat starts once at least two people are going.',
  composerPlaceholder: 'Message',
  sendLabel: 'Send message',
  loadError: "Messages couldn't be loaded.",
  unavailable: 'This gathering is unavailable.',
} as const;

export const MESSAGING_COPY = {
  title: 'Messaging',
  section: 'MESSAGING',
  whoCanMessage: 'WHO CAN MESSAGE ME',
  eventsToggle: 'Let people from my events message me',
  eventsHelper: 'Off by default. Friends can always message you.',
  blockedNever: 'People you have blocked can never message you.',
  blockedSection: 'BLOCKED',
  blockedPeople: 'Blocked people',
  minorTitle: 'Messages are friends only.',
  minorHelper:
    'Only people you have accepted as friends can message you. There is no setting to change.',
  noBlocked: 'You have not blocked anyone.',
  unblock: 'Unblock',
} as const;

export const ATTENDEE_COPY = {
  whosComing: "Who's coming",
  hostOnlyPill: 'Only you can see this',
  hostOnlyLabel: 'Only you can see this.',
  showMore: (count: number) => `Show ${count} more going`,
  caption: 'Names and age bands only. Never emails, locations or birth dates.',
  goingCount: (count: number) => `${count} going`,
  youHost: 'You, host',
  ageBand: { adult: 'Adult', teen: '13–17', under13: 'Under 13' },
  relationship: { self: '', spouse: 'Spouse', child: 'Child' },
  pastTitle: (count: number) => `Who was there · ${count}`,
  pastLabel: 'Past event',
  familyMember: 'Family member',
  showMorePast: (count: number) => `Show ${count} more`,
  pastNote: 'Profiles show only what each person allows.',
} as const;

export const GOING_COPY = {
  title: "You're going",
  whosComing: "Who's coming?",
  me: 'Me',
  yourRsvp: 'Your RSVP',
  addFamilyMember: 'Add family member',
  saveChanges: 'Save changes',
  addToCalendar: 'Add to calendar',
  cancelRsvp: 'Cancel RSVP',
  keepRsvp: 'Keep my RSVP',
  cancelTitle: 'Cancel your RSVP?',
  cancelBody: (title: string) =>
    `You and your family members will be removed from ${title}. This event will return to your Discover deck.`,
  cancelled: 'RSVP cancelled',
  photos: 'Photos',
  chat: 'Chat',
  confirmRsvp: 'Confirm RSVP',
  underThirteenNote: "Family members under 13 are RSVP names only — they don't have accounts.",
  notEligible: (band: string) => `Not eligible: ${band}`,
  outsideRange: "Outside this event's age range",
  eligibilityMissing: 'This gathering is for a different age range.',
  hasStarted: 'This gathering has already started.',
} as const;

export const FAMILY_COPY = {
  title: 'My family',
  back: 'Profile',
  intro: 'Add a spouse or child under 18 so you can RSVP for them. Only you can see this list.',
  section: 'FAMILY MEMBERS',
  ageBand: (band: string) => `Age band: ${band}`,
  add: 'Add family member',
  footer: 'We only keep names and, for children under 18, birth month and year. No photos.',
  sheetTitle: 'Add family member',
  name: 'Name',
  relationship: 'Relationship',
  sex: 'Sex',
  birth: 'Birth month and year',
  birthHelper: 'Shown only for children. We keep just the month and year.',
  addCta: 'Add',
  remove: 'Remove',
  relationships: { spouse: 'Spouse', child: 'Child' },
  sexes: { male: 'Male', female: 'Female' },
  membersCount: (count: number) => (count === 1 ? '1 member' : `${count} members`),
} as const;

export const PROFILE_COPY = {
  title: 'Profile',
  changePhoto: 'Change photo',
  account: 'ACCOUNT',
  name: 'Name',
  city: 'City',
  birthDate: 'Birth date',
  sex: 'Sex',
  sexHelper: "Only used for men's or women's events",
  male: 'Male',
  female: 'Female',
  church: 'CHURCH',
  yourChurch: 'Your church',
  churchHelper: 'Search to choose a different church. Not a member anywhere? Leave this blank.',
  searchChurches: 'Search churches',
  churchAddHelper: "Shows what you type if your church isn't listed",
  visibility: 'VISIBILITY',
  visibilityHeading: 'Who can see my profile',
  visibilityFooter:
    'Your location and family are never shown to anyone. Email and phone appear only if you turn them on.',
  defaultTag: 'Default',
  contactInfo: 'CONTACT INFO',
  email: 'Email',
  phone: 'Phone (optional)',
  phonePlaceholder: 'Add phone number',
  phoneHint: '10-digit US number',
  showOnProfile: 'Show on my profile',
  contactHelper: 'Only people allowed by the visibility setting above can see these. Hidden by default.',
  emailReadOnly: 'Read-only. This is the email you signed in with.',
  location: 'LOCATION',
  pullToRefresh: 'Pull down to refresh your profile.',
  friendsRow: 'Friends',
  myFamilyRow: 'My family',
  saved: 'Profile saved',
  contactAdmins: 'Contact the church admins',
  contactAdminsSub: 'Questions, reports or help with your account.',
} as const;

export type VisibilityLevel = 'only_me' | 'church' | 'friends' | 'public';

export const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: VisibilityLevel;
  label: string;
  helper: string;
}> = [
  { value: 'only_me', label: 'Only me', helper: 'Nobody else can open your profile.' },
  {
    value: 'church',
    label: 'People in my church',
    helper: 'People in your church can see your first name, photo and short bio.',
  },
  {
    value: 'friends',
    label: 'Friends',
    helper: 'Only friends you have accepted can see your first name, photo and short bio.',
  },
  {
    value: 'public',
    label: 'Public',
    helper: 'Any signed-in Foyer user can see your first name, photo and short bio.',
  },
];

export const PICKER_COPY = {
  dayTitle: 'Date',
  birthTitle: 'Birth date',
  monthYearTitle: 'Birth month and year',
  startTimeTitle: 'Start time',
  endTimeTitle: 'Ends',
  when: 'WHEN',
  date: 'Date',
  startTime: 'Start time',
  ends: 'Ends',
  noEndTime: 'No end time',
  chooseDate: 'Choose a date.',
  chooseStart: 'Choose a start time.',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  chooseMonthYear: 'Choose month and year',
  weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
} as const;

export const ACCOUNT_SAFETY_COPY = {
  adminContactTitle: 'Church admin contact',
  adminContactBody:
    'To report a problem, ask for help, or have something removed, contact the church admins.',
} as const;
