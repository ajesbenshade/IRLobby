import {
  buildRsvpPeople,
  canCancelRsvp,
  canSeeChat,
  hasEventStarted,
  hasSelectionChanged,
  isEmptySelection,
  isGoingRsvp,
  notEligibleReason,
  selectionFromMyRsvp,
} from '../rsvp';

const NOW = new Date('2026-10-17T12:00:00Z');

describe('cancel RSVP rules', () => {
  const future = '2026-10-18T22:00:00Z';
  const past = '2026-10-17T10:00:00Z';

  it('is offered to going guests before the event starts', () => {
    expect(canCancelRsvp({ isHost: false, isGoing: true, time: future, now: NOW })).toBe(true);
  });
  it('is hidden for hosts', () => {
    expect(canCancelRsvp({ isHost: true, isGoing: true, time: future, now: NOW })).toBe(false);
  });
  it('is hidden once the event has started', () => {
    expect(hasEventStarted(past, NOW)).toBe(true);
    expect(canCancelRsvp({ isHost: false, isGoing: true, time: past, now: NOW })).toBe(false);
  });
  it('is hidden when not going', () => {
    expect(canCancelRsvp({ isHost: false, isGoing: false, time: future, now: NOW })).toBe(false);
  });
});

describe('chat visibility', () => {
  it('only the host and people going see Chat', () => {
    expect(canSeeChat({ isHost: false, isGoing: false })).toBe(false);
    expect(canSeeChat({ isHost: false, isGoing: true })).toBe(true);
    expect(canSeeChat({ isHost: true, isGoing: false })).toBe(true);
    expect(isGoingRsvp({ status: 'confirmed' })).toBe(true);
    expect(isGoingRsvp(null)).toBe(false);
  });
});

describe('You are going selection', () => {
  const saved = selectionFromMyRsvp({ include_self: true, dependent_ids: [2], member_ids: [2, 5] });

  it('merges dependent_ids and member_ids', () => {
    expect(saved).toEqual({ includeSelf: true, memberIds: [2, 5] });
  });
  it('Save changes shows only after the selection changes', () => {
    expect(hasSelectionChanged(saved, { includeSelf: true, memberIds: [5, 2] })).toBe(false);
    expect(hasSelectionChanged(saved, { includeSelf: true, memberIds: [2] })).toBe(true);
    expect(hasSelectionChanged(saved, { includeSelf: false, memberIds: [2, 5] })).toBe(true);
  });
  it('nobody checked becomes the cancel flow', () => {
    expect(isEmptySelection({ includeSelf: false, memberIds: [] })).toBe(true);
    expect(isEmptySelection(saved)).toBe(false);
  });
});

describe('who is coming people', () => {
  it('words the age reason from the event range and keeps ineligible people listed', () => {
    expect(notEligibleReason("Outside this event's age range", { age_min: 13, age_max: 17 })).toBe(
      'Not eligible: ages 13–17',
    );
    const people = buildRsvpPeople(
      {
        me: { name: 'Anna', eligible: true },
        dependents: [],
        members: [
          { id: 1, name: 'Rachel', eligible: true, relationship: 'spouse' },
          { id: 2, name: 'Noah', eligible: false, age: 11, relationship: 'child', reason: null },
        ],
      },
      { age_min: 13, age_max: 17 },
    );
    expect(people.map((person) => person.name)).toEqual(['Me', 'Rachel', 'Noah']);
    expect(people[2]).toMatchObject({ eligible: false, reason: 'Not eligible: ages 13–17', subtitle: 'Child · age 11' });
    expect(people[1].subtitle).toBe('Spouse');
  });
});
