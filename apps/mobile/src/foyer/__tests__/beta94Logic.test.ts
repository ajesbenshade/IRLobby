import { AxiosError, AxiosHeaders } from 'axios';

import {
  foyerOnboardingPayload,
  needsFoyerChurchStep,
  showsLegacyOnboarding,
  showsPickChurchCard,
} from '../firstRun';
import {
  eventLimitSheetBody,
  formatHostDateLong,
  formatHostDateShort,
  hostLimitBanner,
  hostLimitState,
  parseEventLimitError,
  photoLimitNotice,
} from '../hostLimit';
import { feedbackBody, feedbackMailto, helpMailto, mailtoUrl } from '../support';
import { deleteGatheringBody } from '@components/foyer/DeleteGatheringSheet';

jest.mock('@services/apiClient', () => ({ api: { patch: jest.fn() } }));
jest.mock('@services/authService', () => ({ updateOnboarding: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const axiosError = (status: number, data: unknown, headers: Record<string, string> = {}) => {
  const error = new AxiosError('Request failed', String(status));
  error.response = {
    status,
    data,
    statusText: '',
    headers: new AxiosHeaders(headers),
    config: { headers: new AxiosHeaders() },
  } as never;
  return error;
};

// Sunday, Oct 25 2026, 10:22 AM in the box/phone's local zone.
const OPENS = new Date(2026, 9, 25, 10, 22);
const NOW = new Date(2026, 9, 18, 10, 30);

describe('first run: no legacy onboarding in Foyer mode', () => {
  it('never shows the legacy onboarding / vibe quiz in Foyer mode; legacy mode keeps it', () => {
    const fresh = { onboardingCompleted: false };
    expect(showsLegacyOnboarding(fresh, true)).toBe(false);
    expect(needsFoyerChurchStep(fresh, true)).toBe(true);
    expect(showsLegacyOnboarding(fresh, false)).toBe(true);
    expect(needsFoyerChurchStep(fresh, false)).toBe(false);
  });

  it('existing (onboarded) accounts skip both', () => {
    const done = { onboardingCompleted: true };
    expect(showsLegacyOnboarding(done, true)).toBe(false);
    expect(needsFoyerChurchStep(done, true)).toBe(false);
    expect(needsFoyerChurchStep(null, true)).toBe(false);
  });

  it('finishes onboarding with the quiz marked skipped and existing preferences kept (no terms re-accepted)', () => {
    const payload = foyerOnboardingPayload({ onboardingCompleted: false, activityPreferences: { low_key: true, vibe: { a: 1 } } });
    expect(payload).toEqual({
      onboarding_completed: true,
      activity_preferences: { low_key: true, vibe: { a: 1, vibeQuizSkipped: true } },
    });
    expect('terms_accepted' in payload).toBe(false);
  });

  it('Pick your church: Discover until dismissed, Profile always, never once a church is set or in legacy mode', () => {
    expect(showsPickChurchCard({ churchId: null, surface: 'discover', dismissed: false }, true)).toBe(true);
    expect(showsPickChurchCard({ churchId: null, surface: 'discover', dismissed: true }, true)).toBe(false);
    expect(showsPickChurchCard({ churchId: null, surface: 'profile', dismissed: true }, true)).toBe(true);
    expect(showsPickChurchCard({ churchId: 4, surface: 'profile', dismissed: false }, true)).toBe(false);
    expect(showsPickChurchCard({ churchId: null, surface: 'profile', dismissed: false, hiddenThisVisit: true }, true)).toBe(false);
    expect(showsPickChurchCard({ churchId: null, surface: 'discover', dismissed: false }, false)).toBe(false);
  });
});

describe('weekly host limit states (event_limit_exempt + next_host_available_at)', () => {
  it('missing or null fields mean no limit (older servers)', () => {
    expect(hostLimitState({}, NOW)).toEqual({ blocked: false });
    expect(hostLimitState({ nextHostAvailableAt: null }, NOW)).toEqual({ blocked: false });
    expect(hostLimitState({ nextHostAvailableAt: 'not a date' }, NOW)).toEqual({ blocked: false });
    expect(hostLimitState(null, NOW)).toEqual({ blocked: false });
  });

  it('a past time means they can host again', () => {
    expect(hostLimitState({ nextHostAvailableAt: new Date(2026, 9, 17).toISOString() }, NOW)).toEqual({ blocked: false });
  });

  it('a future time blocks non-exempt members; event_limit_exempt never blocks', () => {
    const iso = OPENS.toISOString();
    const blocked = hostLimitState({ nextHostAvailableAt: iso, eventLimitExempt: false }, NOW);
    expect(blocked.blocked).toBe(true);
    expect(hostLimitState({ nextHostAvailableAt: iso, eventLimitExempt: true }, NOW)).toEqual({ blocked: false });
  });

  it('formats local time with the time of day (frames 246-247)', () => {
    expect(formatHostDateShort(OPENS)).toBe('Sun, Oct 25 at 10:22 AM');
    expect(formatHostDateLong(OPENS)).toBe('Sunday, Oct 25 at 10:22 AM');
    expect(formatHostDateShort(new Date(2026, 9, 25, 0, 5))).toBe('Sun, Oct 25 at 12:05 AM');
    expect(formatHostDateShort(new Date(2026, 9, 25, 12, 0))).toBe('Sun, Oct 25 at 12:00 PM');
    expect(hostLimitBanner(OPENS)).toBe('You can host one gathering a week. Your next one opens Sun, Oct 25 at 10:22 AM.');
  });

  it('429 event_limit_reached: Design copy from next_allowed_at, server detail ignored', () => {
    const error = axiosError(429, {
      code: 'event_limit_reached',
      detail: 'Server wording that should not show.',
      limit: 1,
      period: 'week',
      retry_after: 600,
      next_allowed_at: OPENS.toISOString(),
    });
    const parsed = parseEventLimitError(error, NOW);
    expect(parsed?.nextAllowedAt?.getTime()).toBe(OPENS.getTime());
    expect(eventLimitSheetBody(parsed?.nextAllowedAt ?? null)).toBe(
      'Members can host one gathering each week. You can start your next one on Sunday, Oct 25 at 10:22 AM, or ask a church admin to post it for you.',
    );
  });

  it('falls back to retry_after, and ignores other errors', () => {
    const parsed = parseEventLimitError(axiosError(429, { code: 'event_limit_reached', retry_after: 3600 }), NOW);
    expect(parsed?.nextAllowedAt?.getTime()).toBe(NOW.getTime() + 3600 * 1000);
    expect(parseEventLimitError(axiosError(429, { code: 'throttled' }), NOW)).toBeNull();
    expect(parseEventLimitError(axiosError(400, { code: 'event_limit_reached' }), NOW)).toBeNull();
    expect(parseEventLimitError(new Error('nope'), NOW)).toBeNull();
  });
});

describe('photo upload limits (frames 248-249)', () => {
  it('429 throttled: retry_after rounded up to whole minutes', () => {
    expect(photoLimitNotice(axiosError(429, { code: 'throttled', retry_after: 690 }), NOW)).toEqual({
      title: 'Too many photos at once',
      body: 'You can add up to 30 photos an hour. Try again in 12 minutes.',
    });
    expect(photoLimitNotice(axiosError(429, { code: 'throttled', retry_after: 30 }), NOW)?.body).toBe(
      'You can add up to 30 photos an hour. Try again in 1 minute.',
    );
    expect(photoLimitNotice(axiosError(429, { code: 'throttled' }, { 'Retry-After': '120' }), NOW)?.body).toBe(
      'You can add up to 30 photos an hour. Try again in 2 minutes.',
    );
  });

  it('400 event_photo_limit_reached (limit 50)', () => {
    expect(photoLimitNotice(axiosError(400, { code: 'event_photo_limit_reached', limit: 50 }), NOW)).toEqual({
      title: 'This gathering is full of photos',
      body: 'Each gathering can hold 50 photos. Remove one to add another.',
    });
  });

  it('other errors are left to the generic message', () => {
    expect(photoLimitNotice(axiosError(500, {}), NOW)).toBeNull();
    expect(photoLimitNotice(new Error('x'), NOW)).toBeNull();
  });
});

describe('help and feedback email', () => {
  it('Help is a mailto with subject "The Foyer help" (no irlobby.com/help-support)', () => {
    expect(helpMailto()).toBe('mailto:support@irlobby.com?subject=The%20Foyer%20help');
    expect(mailtoUrl('a b')).toBe('mailto:support@irlobby.com?subject=a%20b');
  });

  it('feedback body carries version, build and OS version, and never prints null', () => {
    const body = feedbackBody({ appVersion: '1.0.0', buildNumber: '94', osName: 'iOS', osVersion: '18.1' });
    expect(body).toContain('The Foyer 1.0.0 (build 94)');
    expect(body).toContain('iOS 18.1');
    const sparse = feedbackBody({ appVersion: null, buildNumber: null, osName: 'iOS', osVersion: null });
    expect(sparse).not.toMatch(/null|undefined/);
    const url = feedbackMailto({ appVersion: '1.0.0', buildNumber: '94', osName: 'iOS', osVersion: '18.1' });
    expect(url.startsWith('mailto:support@irlobby.com?subject=The%20Foyer%20beta%20feedback&body=')).toBe(true);
  });
});

describe('delete gathering body', () => {
  it('non-exempt hosts read that deleting does not free this week; exempt hosts see the body as drawn', () => {
    const base =
      "This deletes the gathering and every photo in it, including photos guests added. This can't be undone. If you want to keep any photos, save them first.";
    expect(deleteGatheringBody(true)).toBe(base);
    expect(deleteGatheringBody(false)).toBe(`${base} Deleting it won't let you host another gathering this week.`);
    expect(deleteGatheringBody(undefined)).toBe(`${base} Deleting it won't let you host another gathering this week.`);
  });
});
