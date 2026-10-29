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

const {
  FRANCONIA_CHURCH_NAME,
  PROFILE_SEX_HELPER,
  SHOW_CHILDREN_HELPER,
  SHOW_CHILDREN_ONLY_ME,
  profileSex,
  franconiaChurchId,
  profileSaveBody,
  emptyMailing,
  mailingReady,
  mailingProblem,
  normalizeShowChildren,
  formatMailingAddress,
  mailingFromProfile,
} = load('../src/lib/profileForm.ts');
const { isPersistedImageRef, profileImagePatch } = load('../src/lib/profilePhoto.ts');
const profilePage = readFileSync(path.resolve(__dirname, '../src/pages/profile.tsx'), 'utf8');
const editModal = readFileSync(
  path.resolve(__dirname, '../src/components/EditProfileModal.tsx'),
  'utf8',
);

test('profileSex stays empty until the API sends male or female', () => {
  assert.equal(profileSex(null), '');
  assert.equal(profileSex(undefined), '');
  assert.equal(profileSex(''), '');
  assert.equal(profileSex('other'), '');
  assert.equal(profileSex('male'), 'male');
  assert.equal(profileSex('female'), 'female');
});

test('franconiaChurchId uses an existing Franconia membership, else an exact list match', () => {
  assert.equal(franconiaChurchId({ id: 4, name: 'Franconia Mennonite Church' }), 4);
  assert.equal(
    franconiaChurchId({ id: 9, name: 'Souderton Mennonite Church' }, [
      { id: 2, name: 'Franconia Mennonite' },
      { id: 7, name: 'Franconia Mennonite Church' },
    ]),
    7,
  );
  assert.equal(franconiaChurchId(null, [{ id: 3, name: 'Blooming Glen Mennonite Church' }]), null);
  assert.equal(franconiaChurchId({ name: 'Franconia Mennonite Church' }), null);
});

const saveInput = (overrides = {}) => ({
  sex: 'female',
  churchId: null,
  mailing: emptyMailing(),
  showHouseholdInDirectory: false,
  visibility: 'only_me',
  ...overrides,
});

test('profile save sends male or female and Franconia church id when known', () => {
  assert.equal(profileSaveBody(saveInput({ sex: 'female', churchId: 7 })).sex, 'female');
  assert.equal(profileSaveBody(saveInput({ sex: 'female', churchId: 7 })).church_id, 7);
  assert.equal(profileSaveBody(saveInput({ sex: 'male' })).sex, 'male');
  assert.equal('church_id' in profileSaveBody(saveInput({ sex: '' })), false);
  assert.equal(profileSaveBody(saveInput()).show_mailing_address, false);
  assert.equal(profileSaveBody(saveInput()).show_household_in_directory, false);
  assert.equal(FRANCONIA_CHURCH_NAME, 'Franconia Mennonite Church');
});

test('mailing address show stays off until street, city, state, and ZIP are valid', () => {
  const partial = {
    ...emptyMailing(),
    street: '12 Main',
    city: 'Telford',
    state: 'PA',
    show: true,
  };
  assert.equal(mailingReady(partial), false);
  assert.equal(mailingProblem(partial), 'Enter a street, city, 2-letter state, and ZIP.');
  const ready = { ...partial, postal: '189691234' };
  assert.equal(mailingReady(ready), true);
  const body = profileSaveBody(saveInput({ mailing: ready, visibility: 'church' }));
  assert.equal(body.mailing_postal, '18969-1234');
  assert.equal(body.show_mailing_address, true);
  assert.equal(body.mailing_street2, '');
  assert.equal(normalizeShowChildren('only_me', true), false);
  assert.equal(normalizeShowChildren('church', true), true);
  assert.equal(
    formatMailingAddress({
      street: '12 Main',
      street2: 'Apt 2',
      city: 'Telford',
      state: 'PA',
      postal: '18969',
    }),
    '12 Main\nApt 2\nTelford, PA 18969',
  );
  assert.equal(formatMailingAddress(null), null);
  assert.equal(mailingFromProfile({ sex: 'female' }).known, false);
  assert.equal(
    mailingFromProfile({
      mailing_street: '12 Main',
      mailing_city: 'Telford',
      mailing_state: 'PA',
      mailing_postal: '18969',
      show_mailing_address: true,
    }).known,
    true,
  );
});

test('avatar patch uses avatar_url data URLs and drops blob and profileImageUrl', () => {
  const jpeg = `data:image/jpeg;base64,${'a'.repeat(32)}`;
  assert.equal(isPersistedImageRef(jpeg), true);
  assert.equal(isPersistedImageRef('blob:http://localhost/photo'), false);
  assert.equal(isPersistedImageRef('http://example.com/a.jpg'), false);
  assert.deepEqual(
    profileImagePatch({ avatarUrl: jpeg, photoAlbum: [jpeg, 'blob:http://localhost/x'] }),
    {
      avatar_url: jpeg,
      photo_album: [jpeg],
    },
  );
  assert.deepEqual(profileImagePatch({ avatarUrl: 'blob:http://localhost/photo' }), {});
});

test('profile sex is a selectable control and church search is gone', () => {
  assert.match(profilePage, /role="radiogroup"/);
  assert.match(profilePage, /role="radio"/);
  assert.match(profilePage, /aria-checked=\{selected\}/);
  assert.equal(PROFILE_SEX_HELPER, "Only used for men's or women's events");
  assert.match(profilePage, /\{PROFILE_SEX_HELPER\}/);
  assert.match(profilePage, /profileSaveBody\(\{/);
  assert.match(profilePage, /\{FRANCONIA_CHURCH_NAME\}/);
  assert.match(profilePage, /This app is for Franconia\./);
  assert.match(profilePage, /avatar_url: dataUrl/);
  assert.match(profilePage, /Change profile photo/);
  assert.match(profilePage, /SHOW_CHILDREN_LABEL/);
  assert.equal(SHOW_CHILDREN_HELPER.includes('Never the year'), true);
  assert.equal(SHOW_CHILDREN_ONLY_ME.includes('People in my church'), true);
  assert.match(profilePage, /disabled=\{!dirty \|\| saving\}/);
  assert.doesNotMatch(profilePage, /Are you a church member, and where\?/);
  assert.doesNotMatch(profilePage, /Search churches/);
  assert.doesNotMatch(profilePage, /Not a member anywhere\? Leave this blank\./);
  assert.doesNotMatch(profilePage, /Edit Profile/);
  assert.doesNotMatch(profilePage, /createObjectURL/);
  assert.doesNotMatch(profilePage, /<span[\s\S]{0,120}Male/);
  assert.doesNotMatch(editModal, /createObjectURL/);
  assert.match(editModal, /profileImagePatch/);
  assert.match(editModal, /avatarUrl: profileImageUrl/);
});
