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
};

describe('profile visibility', () => {
  it('offers all four levels with Only me first', () => {
    expect(VISIBILITY_OPTIONS.map((option) => option.value)).toEqual(['only_me', 'church', 'friends', 'public']);
    expect(VISIBILITY_OPTIONS.map((option) => option.label)).toEqual([
      'Only me',
      'People in my church',
      'Friends',
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
  it('Save is enabled only after a change', () => {
    expect(isDraftDirty(draft, draft)).toBe(false);
    expect(isDraftDirty(draft, { ...draft, visibility: 'church' })).toBe(true);
  });
  it('computes age from the birth date', () => {
    expect(ageFromIso('2012-03-04', new Date(2026, 9, 1))).toBe(14);
    expect(ageFromIso('1988-12-31', new Date(2026, 9, 1))).toBe(37);
    expect(ageFromIso(null)).toBeNull();
  });
});
