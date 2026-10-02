import { ageBandForAge, canAddFamilyMember, hasSpouse, normalizeFamilyMembers } from '../family';

describe('family members', () => {
  it('uses the members list when the server sends it', () => {
    const members = normalizeFamilyMembers({
      children: [],
      members: [
        { id: 1, name: 'Rachel', relationship: 'spouse', sex: 'female', birth_month: null, birth_year: null, age: null },
        { id: 2, name: 'Caleb', relationship: 'child', sex: 'male', birth_month: 3, birth_year: 2011, age: 15 },
      ],
    });
    expect(members.map((member) => member.relationship)).toEqual(['spouse', 'child']);
    expect(hasSpouse(members)).toBe(true);
  });

  it('falls back to the legacy children list and keeps only month/year', () => {
    const members = normalizeFamilyMembers({
      children: [{ id: 4, name: 'Noah', date_of_birth: '2015-06-20', age: 11 }],
    } as never);
    expect(members).toEqual([
      expect.objectContaining({ id: 4, relationship: 'child', birth_month: 6, birth_year: 2015 }),
    ]);
    expect(members[0]).not.toHaveProperty('date_of_birth');
  });

  it('computes age bands', () => {
    expect(ageBandForAge(9)).toBe('Under 13');
    expect(ageBandForAge(15)).toBe('13–17');
    expect(ageBandForAge(30)).toBeNull();
    expect(ageBandForAge(null)).toBeNull();
  });

  it('Add needs name, relationship, sex, plus birth month/year for a child', () => {
    const base = { name: 'Rachel', relationship: 'spouse' as const, sex: 'female' as const, birthMonth: null, birthYear: null };
    expect(canAddFamilyMember(base)).toBe(true);
    expect(canAddFamilyMember({ ...base, name: ' ' })).toBe(false);
    expect(canAddFamilyMember({ ...base, sex: null })).toBe(false);
    expect(canAddFamilyMember({ ...base, relationship: 'child' })).toBe(false);
    expect(canAddFamilyMember({ ...base, relationship: 'child', birthMonth: 3, birthYear: 2012 })).toBe(true);
  });
});
