import { VISIBILITY_OPTIONS } from '@constants/foyerCopy';

import {
  ageFromIso,
  buildProfilePatch,
  formatPhoneForField,
  isDraftDirty,
  isValidUsPhone,
  phoneError,
  phoneToggleEnabled,
  toE164,
  type ProfileDraft,
} from '../profileForm';

const draft: ProfileDraft = {
  name: 'Anna B.',
  city: 'Souderton, PA',
  dateOfBirth: '1988-03-04',
  sex: 'female',
  churchId: 3,
  visibility: 'only_me',
  phone: '',
  showEmail: false,
  showPhone: false,
  dmFromSharedEvents: false,
  mailingStreet: '',
  mailingStreet2: '',
  mailingCity: '',
  mailingState: '',
  mailingPostal: '',
  showMailingAddress: false,
  showHouseholdInDirectory: false,
};

describe('profile visibility', () => {
  it('offers all four levels with Only me first', () => {
    expect(VISIBILITY_OPTIONS.map((option) => option.value)).toEqual(['only_me', 'friends', 'church', 'public']);
    expect(VISIBILITY_OPTIONS.map((option) => option.label)).toEqual([
      'Only me',
      'Friends',
      'People in my church',
      'Public',
    ]);
  });
});

describe('phone', () => {
  it('validates a 10-digit US number and normalizes to E.164', () => {
    expect(isValidUsPhone('(215) 555-0123')).toBe(true);
    expect(isValidUsPhone('555-0123')).toBe(false);
    expect(toE164('(215) 555-0123')).toBe('+12155550123');
    expect(toE164('1 215 555 0123')).toBe('+12155550123');
    expect(formatPhoneForField('+12155550123')).toBe('(215) 555-0123');
  });
  it('empty is allowed; otherwise show the hint as the error', () => {
    expect(phoneError('')).toBeNull();
    expect(phoneError('123')).toBe('10-digit US number');
  });
  it('the phone toggle is disabled until a valid number is entered', () => {
    expect(phoneToggleEnabled('')).toBe(false);
    expect(phoneToggleEnabled('(215) 555-0123')).toBe(true);
  });
});

describe('profile payload', () => {
  it('sends E.164 phone, visibility and toggles', () => {
    const patch = buildProfilePatch({ ...draft, phone: '(215) 555-0123', showPhone: true }, { isMinor: false });
    expect(patch).toMatchObject({
      profile_visibility: 'only_me',
      phone: '+12155550123',
      show_email: false,
      show_phone: true,
      dm_from_shared_events: false,
      date_of_birth: '1988-03-04',
    });
  });
  it('clears the phone with an empty string and forces show_phone off', () => {
    const patch = buildProfilePatch({ ...draft, phone: '', showPhone: true }, { isMinor: false });
    expect(patch.phone).toBe('');
    expect(patch.show_phone).toBe(false);
  });
  it('under-18 accounts never send the messaging toggle', () => {
    expect(buildProfilePatch({ ...draft, dmFromSharedEvents: true }, { isMinor: true })).not.toHaveProperty(
      'dm_from_shared_events',
    );
  });
  it('sends a valid mailing address and keeps Show off until it is complete', () => {
    const patch = buildProfilePatch(
      {
        ...draft,
        mailingStreet: '12 Main St',
        mailingStreet2: 'Apt 2',
        mailingCity: 'Telford',
        mailingState: 'pa',
        mailingPostal: '18969',
        showMailingAddress: true,
        visibility: 'church',
        showHouseholdInDirectory: true,
      },
      { isMinor: false },
    );
    expect(patch).toMatchObject({
      mailing_street: '12 Main St',
      mailing_street2: 'Apt 2',
      mailing_city: 'Telford',
      mailing_state: 'PA',
      mailing_postal: '18969',
      show_mailing_address: true,
      show_household_in_directory: true,
    });
    const hidden = buildProfilePatch(
      { ...draft, visibility: 'only_me', showHouseholdInDirectory: true, showMailingAddress: true },
      { isMinor: false },
    );
    expect(hidden.show_mailing_address).toBe(false);
    expect(hidden.show_household_in_directory).toBe(false);
  });
  it('Save is enabled only after a change', () => {
    expect(isDraftDirty(draft, draft)).toBe(false);
    expect(isDraftDirty(draft, { ...draft, visibility: 'church' })).toBe(true);
  });
  it('computes age from the birth date', () => {
    expect(ageFromIso('2012-03-04', new Date(2026, 9, 1))).toBe(14);
    expect(ageFromIso('1988-12-31', new Date(2026, 9, 1))).toBe(37);
    expect(ageFromIso(null)).toBeNull();
  });
  it('omits an unchanged birth date so a stored under-18 date is not sent again', () => {
    expect(buildProfilePatch(draft, { isMinor: false, originalDateOfBirth: draft.dateOfBirth })).not.toHaveProperty(
      'date_of_birth',
    );
    expect(
      buildProfilePatch({ ...draft, dateOfBirth: '2012-03-04' }, { isMinor: true, originalDateOfBirth: '2012-03-04' }),
    ).not.toHaveProperty('date_of_birth');
    expect(
      buildProfilePatch({ ...draft, dateOfBirth: '1990-01-02' }, { isMinor: false, originalDateOfBirth: '1988-03-04' })
        .date_of_birth,
    ).toBe('1990-01-02');
  });
});

describe('under-13 server rejection', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { isUnder13Rejection } = require('../profileForm') as typeof import('../profileForm');
  it('recognises the age message and ignores other errors', () => {
    expect(isUnder13Rejection('You must be at least 13 years old.')).toBe(true);
    expect(isUnder13Rejection('Accounts are not available under age 13.')).toBe(true);
    expect(isUnder13Rejection('Accounts are for voting members 18 and older.')).toBe(true);
    expect(isUnder13Rejection('Birthdays can only be shared by accounts 18 and older.')).toBe(false);
    expect(isUnder13Rejection('Enter a valid phone number.')).toBe(false);
    expect(isUnder13Rejection(null)).toBe(false);
  });
});
