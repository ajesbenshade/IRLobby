import fs from 'fs';
import path from 'path';

const src = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

describe('build 94 wiring', () => {
  it('create: a 429 event_limit_reached opens the One gathering a week sheet (Design copy, not the server detail)', () => {
    const form = src('screens/main/FoyerHostForm.tsx');
    expect(form).toMatch(/const limit = parseEventLimitError\(saveError\);\s*if \(limit\) \{[\s\S]*?setLimitSheet\(\{ nextAllowedAt: limit\.nextAllowedAt \}\)/);
    expect(form).toMatch(/<EventLimitSheet\s+visible=\{limitSheet != null\}/);
  });

  it('create: a photo failure after the gathering is saved never leaves the form up (no duplicate posts)', () => {
    const form = src('screens/main/FoyerHostForm.tsx');
    expect(form).toMatch(/catch \(photoError\)[\s\S]*?photoLimitNotice\(photoError\)/);
    expect(form).toMatch(/return \{ saved, photoProblem \}/);
  });

  it('gathering photos: throttle and 50-photo cap open the photo-limit sheet', () => {
    const detail = src('screens/main/GatheringDetailScreen.tsx');
    expect(detail).toMatch(/const notice = photoLimitNotice\(uploadError\);[\s\S]*?setPhotoNotice\(notice\)/);
    expect(detail).toMatch(/<NoticeSheet\s+visible=\{photoNotice != null\}/);
  });

  it('Foyer Profile Help no longer navigates to the hosted help page (legacy layout keeps it)', () => {
    const profile = src('screens/main/ProfileScreen.tsx');
    expect(profile.match(/navigate\("HelpSupport"\)/g)?.length).toBe(1);
    expect(profile).toMatch(/onPress=\{\(\) => void openHelpEmail\(\)\}/);
  });

  it('push: legacy chat/match pushes do nothing in Foyer mode instead of opening the hidden Chat tab', () => {
    expect(src('services/pushNotificationNavigation.ts')).toMatch(
      /screen === 'new_match'\) \{\s*if \(isFoyerMode\(\)\) \{[\s\S]*?return;/,
    );
  });
});

describe('sign-up copy', () => {
  it('Foyer sign-up subtitle is "Join your church on The Foyer." and the legacy pill is hidden', () => {
    const { auth } = require('@constants/copy') as typeof import('@constants/copy');
    expect(auth.register.foyerSubtitle).toBe('Join your church on The Foyer.');
    const register = src('screens/auth/RegisterScreen.tsx');
    expect(register).toMatch(/subtitle=\{isFoyerMode\(\) \? authCopy\.register\.foyerSubtitle : authCopy\.register\.subtitle\}/);
    expect(register).toMatch(/isFoyerMode\(\) \? null : <AccentPill tone="secondary">Real plans, real fast<\/AccentPill>/);
  });
});

describe('Sentry initializes only when EXPO_PUBLIC_SENTRY_DSN is set, and only once', () => {
  const previous = process.env.EXPO_PUBLIC_SENTRY_DSN;
  afterEach(() => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = previous;
    jest.resetModules();
  });

  const boot = () => {
    const init = jest.fn();
    jest.doMock('@sentry/react-native', () => ({ init, captureException: jest.fn(), wrap: (c: unknown) => c, setUser: jest.fn() }));
    jest.isolateModules(() => {
      require('../../lib/monitoring').initMonitoring();
      require('@services/analytics').initAnalytics();
    });
    return init;
  };

  it('with a DSN: one Sentry.init with that DSN', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
    const init = boot();
    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0][0]).toEqual(expect.objectContaining({ dsn: 'https://public@example.ingest.sentry.io/1' }));
  });

  it('without a DSN (EAS production today): no init', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    const init = boot();
    expect(init).not.toHaveBeenCalled();
  });
});
