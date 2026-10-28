import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const load = (rel) => {
  const source = readFileSync(path.resolve(__dirname, rel), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };
  new Function('exports', 'module', outputText)(module.exports, module);
  return module.exports;
};

const { settingsFromProfilePreferences, toSettingsPayload, feedbackMailto, SUPPORT_EMAIL } = load(
  '../src/lib/settingsPreferences.ts',
);

const settingsPage = readFileSync(path.resolve(__dirname, '../src/pages/settings.tsx'), 'utf8');
const profilePage = readFileSync(path.resolve(__dirname, '../src/pages/profile.tsx'), 'utf8');

const storedPrivacy = {
  profileVisibility: 'friends',
  locationSharing: true,
  showAge: false,
  showEmail: true,
  futureKey: { nested: 1 },
};

test('loading keeps stored privacy, hidden preferences, and newMatches', () => {
  const loaded = settingsFromProfilePreferences({
    theme: 'light',
    interests: ['hiking'],
    distanceUnit: 'kilometers',
    maxDistance: 40,
    privacy: storedPrivacy,
    notifications: { messages: false, newMatches: false },
  });

  assert.deepEqual(loaded.privacy, storedPrivacy);
  assert.equal(loaded.preferences.theme, 'light');
  assert.deepEqual(loaded.preferences.interests, ['hiking']);
  assert.equal(loaded.preferences.distanceUnit, 'kilometers');
  assert.equal(loaded.preferences.maxDistance, 40);
  assert.equal(loaded.notifications.messages, false);
  assert.equal(loaded.notifications.newMatches, false);
  assert.equal(loaded.notifications.pushNotifications, true);
});

test('an account with no privacy blob does not get a synthesized one', () => {
  const loaded = settingsFromProfilePreferences({ theme: 'light' });
  assert.equal(loaded.privacy, undefined);
  const payload = toSettingsPayload(loaded);
  assert.equal('privacy' in payload.preferences, false);
  assert.equal(JSON.stringify(payload).includes('profileVisibility'), false);
  assert.equal(JSON.stringify(payload).includes('locationSharing'), false);
  assert.equal(JSON.stringify(payload).includes('showAge'), false);
});

test('saving a notification sends privacy and hidden preferences back untouched', () => {
  const loaded = settingsFromProfilePreferences({
    theme: 'light',
    interests: ['hiking'],
    distanceUnit: 'kilometers',
    maxDistance: 40,
    privacy: storedPrivacy,
    notifications: { newMatches: false, messages: true },
  });
  loaded.notifications.messages = false;
  const payload = toSettingsPayload(loaded);

  assert.deepEqual(payload.preferences.privacy, storedPrivacy);
  assert.equal(payload.preferences.theme, 'light');
  assert.deepEqual(payload.preferences.interests, ['hiking']);
  assert.equal(payload.preferences.distanceUnit, 'kilometers');
  assert.equal(payload.preferences.maxDistance, 40);
  assert.equal(payload.preferences.notifications.messages, false);
  assert.equal(payload.preferences.notifications.newMatches, false);
});

test('feedback mailto uses the existing support address', () => {
  const url = feedbackMailto();
  assert.equal(
    url.startsWith(`mailto:${SUPPORT_EMAIL}?subject=The%20Foyer%20beta%20feedback&body=`),
    true,
  );
  const body = decodeURIComponent(url.split('body=')[1]);
  assert.match(body, /The Foyer web/);
  assert.equal(body.includes('null'), false);
});

test('settings page keeps foyer rows and drops dating-era editors', () => {
  for (const label of [
    'Push notifications',
    'Email notifications',
    'Activity reminders',
    'Messages',
    'Send feedback',
    'Export my data',
    'Delete account',
  ]) {
    assert.equal(settingsPage.includes(label), true, label);
  }
  for (const gone of [
    'Gathering updates',
    'new-matches',
    'Profile Visibility',
    'Show Location',
    'Show Age',
    'Show Email',
    'Friends Only',
    'Distance Unit',
    'Maximum Distance',
    'htmlFor="theme"',
  ]) {
    assert.equal(settingsPage.includes(gone), false, gone);
  }
});

test('profile hides the dating-era Reviews row and keeps Sign Out', () => {
  assert.equal(profilePage.includes('>Reviews<'), false);
  assert.equal(profilePage.includes('/app/reviews'), false);
  assert.equal(profilePage.includes('Sign Out'), true);
});
