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
  download: 'Download',
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
  reportName: (name: string) => `Report ${name || 'this person'}`,
  blockName: (name: string) => `Block ${name || 'this person'}`,
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
  reportSentTitle: 'Report sent',
  reportSentBody: 'The church admins will take a look. Thank you for helping keep The Foyer kind.',
  reportPhoto: 'Report photo',
  reportPhotoLead: "Tell the church admins what's wrong. The person who added it won't be told.",
  minorNoMenu: "Teens' profiles aren't shown. Use Report on a message or photo instead.",
  thisPerson: 'this person',
  /** Gathering detail `...` menu (not shown to the host of that gathering). */
  reportGathering: 'Report this gathering',
  reportGatheringLead: "Tell the church admins what's wrong. The host won't be told.",
  gatheringMenuLabel: 'More options',
  thisGathering: 'this gathering',
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

/** In-app web view for the hosted Terms / Privacy pages (frames 83-84). */
export const LEGAL_VIEW_COPY = {
  done: 'Done',
  loading: 'Loading…',
  failedTitle: "Couldn't load this page.",
  failedBody: 'Check your connection and try again.',
  tryAgain: 'Try again',
  close: 'Close',
  termsTitle: 'Terms of Use',
  privacyTitle: 'Privacy Policy',
} as const;

/** Terms / Privacy consent wording (sign-up, onboarding, login footer). Links are drawn only when the config has a URL. */
export const LEGAL_CONSENT_COPY = {
  checkboxPrefix: 'I agree to the ',
  loginPrefix: 'By continuing you agree to the ',
  terms: 'Terms of Use',
  and: ' and ',
  privacy: 'Privacy Policy',
  suffix: '.',
  signUpRequired: 'Please accept the terms to continue.',
  onboardingRequired: 'Accept the Terms of Use and Privacy Policy to enter the app.',
} as const;

export const GATHERING_CHAT_COPY = {
  title: 'Chat',
  /** Frame gathering-chat-blocked.png says "Her messages"; neutral wording avoids guessing a pronoun. */
  blockedLine: (name: string) => `You blocked ${name || 'this person'}. Their messages are hidden.`,
  copy: 'Copy',
  reportMessage: 'Report message',
  blockPerson: (name: string) => `Block ${name || 'this person'}`,
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
  /** Confirm button inside the "Cancel your RSVP?" sheet (cancel-rsvp-fixed.png). */
  cancelRsvpConfirm: 'Cancel my RSVP',
  keepRsvp: 'Keep my RSVP',
  cancelTitle: 'Cancel your RSVP?',
  cancelBody: "You'll be removed from the guest list and the host will be told.",
  /** Server 400 for a host who tries the guest cancel. Shown as-is if the server sends it. */
  hostCannotCancelRsvp: "Hosts can't cancel an RSVP; use Cancel this gathering instead.",
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
  contactAdminsLead: 'Questions, problems or a report you want to follow up on? Write to the church admins.',
  churchAdminRole: 'Church admin',
  emailAdmins: 'Email the church admins',
  contactMissing: "Contact details aren't available right now. Please try again later.",
  termsRow: 'Terms of Use',
  privacyRow: 'Privacy Policy',
  deleteRow: 'Delete account',
  versionLine: 'The Foyer v1.0',
} as const;

export type VisibilityLevel = 'only_me' | 'church' | 'friends' | 'public';

/** Most private to widest (profile-v3.png, visibility-ladder-v3.png). API values are unchanged. */
export const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: VisibilityLevel;
  label: string;
  helper: string;
}> = [
  { value: 'only_me', label: 'Only me', helper: 'Only you can see your profile.' },
  {
    value: 'friends',
    label: 'Friends',
    helper: 'Your friends can see your first name, photo and short bio.',
  },
  {
    value: 'church',
    label: 'People in my church',
    helper: 'Your friends and people in your church can see your first name, photo and short bio.',
  },
  {
    value: 'public',
    label: 'Public',
    helper: 'Your friends, your church and other people on The Foyer can see your first name, photo and short bio.',
  },
];

/** Host form fallbacks (client check and failed post). The server's own message is shown when it sends one. */
export const HOST_FORM_COPY = {
  missingTitlePlace: 'Add a title and place.',
  postFailed: COMMON_COPY.genericError,
} as const;

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
  /** Birth date grid uses three-letter weekdays, Sunday first (birthdate-day-grid.png). */
  weekdaysLong: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  next: 'Next',
  back: 'Back',
  confirm: 'Confirm',
  birthWheelHelper: 'Choose your month and year, then pick the day.',
  pickADay: 'Pick a day',
  birthCaption: 'Only used to check age ranges on events. Never shown to other people.',
  under13: 'Accounts are not available under age 13.',
  /** Sign-up hint while the (required) birth date is empty. */
  birthRequired: 'Choose your birth date to continue.',
  monthYearHelper: "Month and year only. We don't keep the day.",
  pickPastMonth: 'Pick a month that has already passed.',
} as const;

export const ACCOUNT_SAFETY_COPY = {
  adminContactTitle: 'Church admin contact',
  adminContactBody:
    'To report a problem, ask for help, or have something removed, contact the church admins.',
} as const;

/** Host "Cancel this gathering" (frames 34-42). Wording not final: edit here only. */
export const CANCEL_COPY = {
  hostingBadge: "You're hosting",
  edit: 'Edit',
  whosComing: "Who's coming",
  cancelButton: 'Cancel this gathering',
  helper: 'Everyone who RSVPed will be notified.',
  helperStarted: 'This gathering has already started.',
  sheetTitle: 'Cancel this gathering?',
  sheetBody: "Everyone who RSVPed will be notified right away. This can't be undone.",
  reasonLabel: 'Reason (optional)',
  reasonPlaceholder: 'Let people know why',
  reasonCounter: (count: number, max: number) => `${count}/${max}`,
  confirm: 'Cancel gathering',
  keep: 'Keep gathering',
  successToast: 'Gathering cancelled',
  bannerTitle: 'This gathering was cancelled',
  bannerDate: (date: string) => `Cancelled ${date}`,
  /** Open item (Aaron): heading is "Who was invited" even though the list is people who RSVPed. */
  invitedHeading: 'Who was invited',
  rsvpedCount: (count: number) => `${count} RSVPed`,
  tag: 'Cancelled',
  guestPill: 'Cancelled',
  guestNote: 'You were going',
  seeAll: 'See all',
  openChat: 'Open chat',
  /** Chat system message the backend posts (spec "Copy"); the guest Chat card shows it as the last message. */
  systemMessage: (title: string) => `${title} was cancelled by the host.`,
  systemMessageWithReason: (title: string, reason: string) => `${title} was cancelled by the host. Reason: ${reason}`,
  errorGeneric: "Couldn't cancel. Please try again.",
  errorStarted: "This gathering has already started, so it can't be cancelled.",
  /** 404/405 from an older backend that does not have the endpoint yet. */
  errorUnavailable: "Cancelling isn't available yet. Please try again later.",
  errorForbidden: 'Only the host can cancel this gathering.',
} as const;

/** Require approval (frames 43-66). Wording not final: edit here only. */
export const APPROVAL_COPY = {
  // Host form
  toggleLabel: 'Require approval',
  toggleHelper: 'Review each RSVP request before it counts. Only approved guests take a spot.',
  askAgainLabel: 'Allow asking again',
  askAgainHelper: 'If you decline someone, they can send another request.',
  guestLine: 'Guests will be told the host will see their first name, photo and short bio.',
  turnOffTitle: 'Review your requests first',
  turnOffBody: (count: number) =>
    `You still have ${count === 1 ? '1 request' : `${count} requests`} waiting. Approve or decline them before turning this off.`,
  reviewRequests: 'Review requests',
  notNow: 'Not now',
  // Post gathering footer
  post: 'Post gathering',
  posting: 'Posting…',
  // Guest button states
  requestToJoin: 'Request to join',
  requestSent: 'Request sent',
  requestClosed: 'Request closed',
  askAgain: 'Ask again',
  approvalRequiredTag: 'Approval required',
  // Request sheet
  sheetTitle: 'Request to join',
  sheetGuestLine: 'The host will see your first name, photo and short bio.',
  sendRequest: 'Send request',
  sheetFooter: "You'll get a notification when the host decides.",
  // Guest event states
  pendingEyebrow: 'Request sent',
  pendingTitle: 'Waiting for the host',
  pendingBody: "You'll get a notification when they decide. The address and chat open if you're approved.",
  addressLocked: 'Address shared after approval',
  guestListLocked: 'Guest list opens after approval',
  cancelRequest: 'Cancel request',
  approvedTitle: "You're approved",
  approvedBody: 'The host approved your request. See you there.',
  declinedTitle: 'Request declined',
  declinedBody: "The host can't take your request this time.",
  /** Label above the host's decline note on the declined guest's gathering. Not drawn yet (Aaron approved showing it); placeholder wording. */
  declinedNoteLabel: 'NOTE FROM THE HOST',
  askAgainClearsNote: 'Asking again clears this note.',
  browseOthers: 'Browse other gatherings',
  declinedByHost: 'The host declined your request.',
  requestCancelled: 'Request cancelled',
  /** Guest whose request was pending when the event started (frame 68). */
  closedTitle: 'Request closed',
  closedBody: 'This gathering has already started.',
  tagClosed: 'Closed',
  // Gatherings list tags / groups
  groupRequests: 'REQUESTS',
  tagPending: 'Pending',
  tagApproved: 'Approved',
  tagDeclined: 'Declined',
  // Host gathering row
  requestsRow: 'Requests',
  newBadge: (count: number) => `${count} new`,
  spotsLeftOf: (left: number, total: number) => `${left} ${left === 1 ? 'spot' : 'spots'} left of ${total}`,
  spotsLeft: (left: number) => `${left} ${left === 1 ? 'spot' : 'spots'} left`,
  approvedOnly: 'Approved guests only',
  // Deck
  deckTitle: 'Requests',
  deckBack: 'Gathering',
  deckList: 'List',
  deckSummary: (waiting: number, spotsLeft: number | null) =>
    spotsLeft == null ? `${waiting} waiting` : `${waiting} waiting · ${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`,
  about: 'ABOUT',
  party: 'PARTY',
  partyOf: (size: number, firstName: string) =>
    size <= 1 ? 'Party of 1' : `Party of ${size}: ${firstName}, plus ${size - 1}`,
  ageBand: (band: string) => `Age band: ${band}`,
  decline: 'Decline',
  approve: 'Approve',
  swipeHint: 'Swipe right to approve, left to decline.',
  stampApprove: 'APPROVE',
  stampDecline: 'DECLINE',
  minorLine: 'Teens share their first name and age band only.',
  noFit: 'Not enough spots for this party.',
  noFitCaption: (left: number) =>
    `${left} ${left === 1 ? 'spot' : 'spots'} left. Decline, or raise the limit by editing your gathering.`,
  // Decline sheet. Open: gendered "her" in Design's wording; kept neutral here.
  declineTitle: (name: string) => `Decline ${name}'s request?`,
  declineNoteLabel: 'Add a note (optional)',
  declineHelper: (name: string) => `${name} will see your note in the app and in their notification.`,
  declineCounter: (count: number, max: number) => `${count}/${max}`,
  // Empty / reviewed / list
  emptyTitle: 'No requests waiting',
  emptyBody: "When someone asks to join, they'll show up here.",
  backToGathering: 'Back to gathering',
  reviewedTitle: "You've reviewed everyone",
  reviewedSummary: (going: number, spotsLeft: number | null) =>
    spotsLeft == null
      ? `${going} going`
      : `${going} going · ${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`,
  seeApproved: 'See who you approved',
  tabPending: 'Pending',
  tabApproved: 'Approved',
  tabDeclined: 'Declined',
  approvedChip: 'Approved',
  /** Event started: approve/decline return 400. */
  deckClosedTitle: 'Requests are closed',
  deckClosedBody: "This gathering has already started, so you can't approve or decline requests.",
  loadError: "Requests couldn't be loaded.",
  decideError: "Couldn't save that. Please try again.",
  // Toasts
  approvedToast: 'Approved',
  declinedToast: 'Declined',
  // Push (client fallback titles only; the server writes the real push text)
  relationship: { spouse: 'Spouse', child: 'Child', parent: 'Parent', other: 'Other' },
} as const;

/** Full gatherings (backend `is_full`). No Design frame yet: follows the theme. */
export const FULL_COPY = {
  notice: 'This gathering is full.',
  /** Grey banner (frames 74-75) and the disabled button label that replaces I'm going / Request to join. */
  banner: 'This gathering is full',
  buttonLabel: 'Gathering full',
  tag: 'Full',
  hostCaption: "Pending requests can't be approved until a spot opens.",
  /** Server 400 detail on RSVP / join / swipe / request. */
  serverMessage: 'This gathering is full.',
} as const;

/**
 * Delete account (Settings > Account). Retention numbers approved by Aaron:
 * backups up to 30 days, minimal safety reports kept 12 months. If Backend changes what the server removes,
 * edit here only.
 */
export const DELETE_ACCOUNT_COPY = {
  deleteRowTitle: 'Delete account',
  rowSubtitle: 'Permanently delete your profile and everything attached to it.',
  retention:
    'We keep a minimal record of safety reports for up to 12 months so we can protect other members. Backups are cleared within 30 days.',
  /** Backend wording for the whole-screen body (frames 90-91). */
  screenBody:
    "This permanently deletes your profile, photo, contact info, friends, friend requests, one-to-one chats, your messages in gathering chats, family members, RSVPs and photos you added. Gatherings you host will be cancelled, and the people going will be told first. This can't be undone.",
  bullets: [
    'Your profile and photo',
    'Your contact info',
    'Friends and friend requests',
    'One-to-one chats',
    'Your messages in gathering chats',
    'Family members',
    'RSVPs',
    'Photos you added',
    'Gatherings you host are cancelled, and the people going are told first',
  ],
  hostingNote: (count: number) =>
    `You host ${count} upcoming ${count === 1 ? 'gathering' : 'gatherings'}. ${count === 1 ? "It'll" : "They'll"} be cancelled and the people going will be told.`,
  typeLabel: 'Type DELETE to confirm',
  typeWord: 'DELETE',
  deleteButton: 'Delete my account',
  keepButton: 'Keep my account',
  alertTitle: 'Delete your account?',
  alertBody: "This can't be undone.",
  alertCancel: 'Cancel',
  alertDelete: 'Delete',
  working: 'Deleting your account…',
  failedTitle: "Couldn't delete your account.",
  failedBody: 'Nothing was removed. Please try again.',
  tryAgain: 'Try again',
  doneTitle: 'Your account was deleted',
  doneBody: "Your data has been removed. You're welcome back any time.",
  close: 'Close',
} as const;
