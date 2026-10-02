import { applyClientEligibility, buildRsvpPeople, eligibleMemberIds, eventLocalDay, memberAgeOnEvent } from '../rsvp';
import type { WhosComingResponse } from '../logic';

// Saturday Nov 14, 2026, 7pm New York.
const EVENT = '2026-11-14T19:00:00-05:00';
const teens = { age_min: 13, age_max: 18, time: EVENT };

const child = (overrides: Record<string, unknown>) => ({ id: 1, name: 'Kid', eligible: true, reason: null, relationship: 'child', ...overrides });
const sheet = (...members: ReturnType<typeof child>[]): WhosComingResponse => ({
  me: { name: 'Me', eligible: true },
  dependents: members as never,
  members: members as never,
});

describe('client-side age check (does not rely only on the server eligible flag)', () => {
  it('blocks a 3-year-old from a 13-18 gathering even when the server flag says eligible', () => {
    const response = applyClientEligibility(sheet(child({ id: 1, name: 'Mia', birth_year: 2023, birth_month: 3, birth_day: 4, date_of_birth: '2023-03-04' })), teens);
    const mia = response.members?.[0];
    expect(mia?.eligible).toBe(false);
    expect(mia?.reason).toBe('Not eligible: ages 13–18');
  });

  it('uses the server event-day age when the payload has no exact birthdate', () => {
    const response = applyClientEligibility(sheet(child({ id: 1, age: 3 })), teens);
    expect(response.dependents[0].eligible).toBe(false);
  });

  it('checks the upper bound too', () => {
    const response = applyClientEligibility(sheet(child({ id: 1, date_of_birth: '2012-01-05', birth_day: 5, birth_month: 1, birth_year: 2012 })), { age_max: 12, time: EVENT });
    expect(response.dependents[0].eligible).toBe(false);
  });

  it('turning the minimum age ON the event day is allowed, the day after is not (event day in New York)', () => {
    const onDay = child({ id: 1, birth_year: 2013, birth_month: 11, birth_day: 14, date_of_birth: '2013-11-14' });
    const dayAfter = child({ id: 2, birth_year: 2013, birth_month: 11, birth_day: 15, date_of_birth: '2013-11-15' });
    const response = applyClientEligibility(sheet(onDay, dayAfter), { age_min: 13, time: EVENT });
    expect(response.dependents.map((member) => member.eligible)).toEqual([true, false]);
    // 03:30 UTC on Nov 15 is still Nov 14 in New York.
    expect(eventLocalDay('2026-11-15T03:30:00Z')).toEqual({ year: 2026, month: 11, day: 14 });
  });

  it('legacy month/year rows count as the last day of the month (Backend rule)', () => {
    const legacy = child({ id: 1, birth_year: 2013, birth_month: 11, date_of_birth: '2013-11-30' });
    expect(memberAgeOnEvent(legacy as never, { age_min: 13, time: EVENT })).toBe(12);
    expect(applyClientEligibility(sheet(legacy), { age_min: 13, time: EVENT }).dependents[0].eligible).toBe(false);
  });

  it('never blocks a child the server counts as old enough (exact birthday earlier in the month, day not in the list)', () => {
    const exactButDayHidden = child({ id: 1, birth_year: 2013, birth_month: 11, age: 13 });
    expect(applyClientEligibility(sheet(exactButDayHidden), { age_min: 13, time: EVENT }).dependents[0].eligible).toBe(true);
  });

  it('leaves spouses, people without birth data, and gatherings without an age range alone', () => {
    const spouse = child({ id: 1, name: 'Rachel', relationship: 'spouse' });
    const unknown = child({ id: 2, name: 'Eli' });
    const response = applyClientEligibility(sheet(spouse, unknown), teens);
    expect(response.dependents.every((member) => member.eligible)).toBe(true);
    const noRange = sheet(child({ id: 3, age: 3 }));
    expect(applyClientEligibility(noRange, { time: EVENT })).toBe(noRange);
    expect(applyClientEligibility(noRange, null)).toBe(noRange);
  });

  it('keeps the server reason when the server already blocked them', () => {
    const response = applyClientEligibility(sheet(child({ id: 1, eligible: false, reason: 'This gathering is for women.', age: 3 })), teens);
    expect(response.dependents[0].reason).toBe('This gathering is for women.');
  });

  it('buildRsvpPeople returns a disabled row with the reason, and eligibleMemberIds drops them from the payload', () => {
    const response = sheet(
      child({ id: 1, name: 'Mia', age: 3, birth_year: 2023, birth_month: 3, birth_day: 4, date_of_birth: '2023-03-04' }),
      child({ id: 2, name: 'Caleb', age: 15, birth_year: 2011, birth_month: 6, birth_day: 9, date_of_birth: '2011-06-09' }),
    );
    const people = buildRsvpPeople(response, teens);
    expect(people.find((person) => person.name === 'Mia')).toMatchObject({ eligible: false, reason: 'Not eligible: ages 13–18' });
    expect(people.find((person) => person.name === 'Caleb')?.eligible).toBe(true);
    expect(eligibleMemberIds(response, teens, [1, 2])).toEqual([2]);
  });
});
