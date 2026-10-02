import {
  audienceChipLabel,
  buildRsvpPayload,
  confirmGoingLabel,
  defaultRsvpSelection,
  friendlyRsvpMessage,
  gatheringLocationLabel,
  hasNoEligiblePeople,
  parseCapacity,
  peopleCount,
  registrationFieldError,
  isChatGateError,
  shouldSkipWhosComingSheet,
  whosGoingSummary,
} from '../logic';

describe('audience chip', () => {
  it('uses the API audience string when present', () => {
    expect(audienceChipLabel({ audience: 'Women · 18+', audience_gender: 'everyone' })).toBe('Women · 18+');
  });

  it('builds Everyone, 18+, Ages 6+, and Ages 6–17', () => {
    expect(audienceChipLabel({ audience_gender: 'everyone' })).toBe('Everyone');
    expect(audienceChipLabel({ audience_gender: 'women', age_min: 18, age_max: null })).toBe('Women · 18+');
    expect(audienceChipLabel({ audience_gender: 'everyone', age_min: 6, age_max: null })).toBe('Everyone · Ages 6+');
    expect(audienceChipLabel({ audience_gender: 'everyone', age_min: 6, age_max: 17 })).toBe('Everyone · Ages 6–17');
  });
});

describe('RSVP payload', () => {
  const response = {
    me: { name: 'Anna B.', eligible: true, reason: null },
    dependents: [
      { id: 1, name: 'Child 1', age: 9, eligible: true, reason: null },
      { id: 2, name: 'Child 2', age: 12, eligible: true, reason: null },
      { id: 3, name: 'Child 3', age: 4, eligible: false, reason: "Outside this event's age range" },
    ],
  };

  it('skips the sheet only when the household list is empty', () => {
    expect(shouldSkipWhosComingSheet({ dependents: [] })).toBe(true);
    expect(shouldSkipWhosComingSheet(response)).toBe(false);
  });

  it('preselects Me and eligible children, then posts include_self and dependent_ids', () => {
    const selection = defaultRsvpSelection(response);
    expect(selection).toEqual({ includeSelf: true, dependentIds: [1, 2] });
    expect(buildRsvpPayload(selection.includeSelf, selection.dependentIds)).toEqual({
      include_self: true,
      dependent_ids: [1, 2],
      member_ids: [1, 2],
    });
    expect(peopleCount(true, [1])).toBe(2);
    expect(confirmGoingLabel(2)).toBe('Confirm · 2 going');
  });
});

describe('capacity validation', () => {
  it('treats a blank capacity as unlimited and rejects values outside 1–500', () => {
    expect(parseCapacity('')).toEqual({ ok: true, capacity: null });
    expect(parseCapacity('  ')).toEqual({ ok: true, capacity: null });
    expect(parseCapacity('40')).toEqual({ ok: true, capacity: 40 });
    expect(parseCapacity('0').ok).toBe(false);
    expect(parseCapacity('501').ok).toBe(false);
    expect(parseCapacity('12.5').ok).toBe(false);
  });
});

describe('going summary and registration', () => {
  it('summarizes who is going', () => {
    expect(whosGoingSummary(1)).toBe('You');
    expect(whosGoingSummary(2)).toBe('You + 1 child');
  });

  it('surfaces the under-13 registration error from the API', () => {
    expect(registrationFieldError({ date_of_birth: ['Accounts are not available under age 13.'] })).toBe(
      'Accounts are not available under age 13.',
    );
  });

  it('treats the chat gate 403 as the going-only message', () => {
    expect(isChatGateError(403, 'Not authorized')).toBe(true);
    expect(isChatGateError(400, 'Capacity must be a whole number from 1 to 500.')).toBe(false);
  });
});

describe('gathering address label', () => {
  it('shows the address when present and a placeholder when it is hidden or missing', () => {
    expect(gatheringLocationLabel('123 Main St')).toBe('123 Main St');
    expect(gatheringLocationLabel('  ')).toBe('Address shared after you RSVP');
    expect(gatheringLocationLabel('')).toBe('Address shared after you RSVP');
    expect(gatheringLocationLabel(null)).toBe('Address shared after you RSVP');
    expect(gatheringLocationLabel(undefined)).toBe('Address shared after you RSVP');
  });
});

describe('RSVP messages', () => {
  it('rewrites the older server wording to the family wording', () => {
    expect(friendlyRsvpMessage('Choose yourself or a child.')).toBe('Choose yourself or your family.');
    expect(friendlyRsvpMessage('Event is full.')).toBe('Event is full.');
  });

  it('detects when nobody can be selected so an empty RSVP is never posted', () => {
    const nobody = {
      me: { name: 'A', eligible: false, reason: "Outside this event's age range" },
      dependents: [{ id: 1, name: 'Kid', age: 4, eligible: false }],
    };
    expect(hasNoEligiblePeople(nobody)).toBe(true);
    expect(hasNoEligiblePeople({ ...nobody, dependents: [{ id: 1, name: 'Kid', age: 15, eligible: true }] })).toBe(false);
    expect(hasNoEligiblePeople({ me: { name: 'A', eligible: true }, dependents: [] })).toBe(false);
  });
});
