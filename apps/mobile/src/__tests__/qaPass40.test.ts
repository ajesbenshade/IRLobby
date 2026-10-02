import * as fs from 'fs';
import * as path from 'path';

import { COMMON_COPY, HOST_FORM_COPY, MEMBER_COPY } from '@constants/foyerCopy';
import { cancelErrorMessage } from '@components/foyer/CancelRsvpSheet';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

/** Follow-up to PR #37 / #39 design QA: StyleSheet values and strings that are only visible in source. */
const read = (relative: string) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

describe('host form audience segment is a 48pt tap target', () => {
  it('segmentItem minHeight is 48', () => {
    expect(read('screens/main/FoyerHostForm.tsx')).toMatch(/segmentItem: \{ flex: 1, minHeight: 48,/);
  });
});

describe('send arrow on the burgundy send button is pure white', () => {
  it.each(['screens/main/GatheringChatScreen.tsx', 'screens/main/DirectChatScreen.tsx'])('%s', (file) => {
    const source = read(file);
    expect(source).toMatch(/name="arrow-up" size=\{22\} color=\{sendEnabled \? '#ffffff' : '#7a7572'\}/);
    expect(source).not.toContain("'#f6f1ee' : '#7a7572'");
  });
});

describe('hardcoded fallbacks now come from foyerCopy', () => {
  it('host form and RSVP sheet no longer carry inline English fallbacks', () => {
    const hostForm = read('screens/main/FoyerHostForm.tsx');
    expect(hostForm).not.toContain("'Unable to post this gathering.'");
    expect(hostForm).not.toContain("'Add a title and place.'");
    expect(hostForm).toContain('HOST_FORM_COPY.postFailed');
    expect(hostForm).toContain('HOST_FORM_COPY.missingTitlePlace');
    expect(read('components/foyer/CancelRsvpSheet.tsx')).not.toContain('Unable to cancel your RSVP.');
  });

  it('uses the spec strings', () => {
    expect(HOST_FORM_COPY.missingTitlePlace).toBe('Add a title and place.');
    expect(HOST_FORM_COPY.postFailed).toBe(COMMON_COPY.genericError);
    expect(COMMON_COPY.genericError).toBe('Something went wrong. Please try again.');
  });

  it('a failed Cancel RSVP with no server message reads the spec generic error', () => {
    expect(cancelErrorMessage({})).toBe(COMMON_COPY.genericError);
    expect(cancelErrorMessage({ response: { data: { detail: 'You are not going.' } } })).toBe('You are not going.');
  });

  it('the unused fullNotice style is gone from the gathering detail', () => {
    expect(read('screens/main/GatheringDetailScreen.tsx')).not.toMatch(/^\s*fullNotice: \{/m);
  });
});

describe('every CANCEL_COPY guest string is now used', () => {
  it('seeAll, openChat and whosComing are referenced by a screen or component', () => {
    const used =
      read('components/foyer/CancelledGuestCards.tsx') + read('screens/main/GatheringDetailScreen.tsx');
    expect(used).toContain('CANCEL_COPY.seeAll');
    expect(used).toContain('CANCEL_COPY.openChat');
    expect(used).toContain('CANCEL_COPY.whosComing');
  });
});

describe('Report this gathering', () => {
  it('uses the spec label', () => {
    expect(MEMBER_COPY.reportGathering).toBe('Report this gathering');
  });
});
