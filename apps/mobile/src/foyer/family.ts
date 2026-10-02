import { FAMILY_COPY } from '@constants/foyerCopy';

import type { FamilyMember, FamilyRelationship, HouseholdResponse } from '../services/foyerService';

const RELATIONSHIPS: FamilyRelationship[] = ['spouse', 'child'];

const asRelationship = (value: unknown): FamilyRelationship =>
  RELATIONSHIPS.includes(value as FamilyRelationship) ? (value as FamilyRelationship) : 'child';

/**
 * Build the My family list from either the documented `members` shape or the
 * older `children`-only response. Birth dates are never kept: only month/year.
 */
export const normalizeFamilyMembers = (data: HouseholdResponse | null | undefined): FamilyMember[] => {
  if (Array.isArray(data?.members)) {
    return data.members.map((member) => ({
      id: member.id,
      name: member.name,
      relationship: asRelationship(member.relationship),
      sex: member.sex ?? null,
      birth_month: member.birth_month ?? null,
      birth_year: member.birth_year ?? null,
      age: member.age ?? null,
    }));
  }
  return (data?.children ?? []).map((child) => {
    const match = /^(\d{4})-(\d{2})/.exec(child.date_of_birth ?? '');
    return {
      id: child.id,
      name: child.name,
      relationship: 'child' as const,
      sex: child.sex ?? null,
      birth_month: child.birth_month ?? (match ? Number(match[2]) : null),
      birth_year: child.birth_year ?? (match ? Number(match[1]) : null),
      age: child.age ?? null,
    };
  });
};

/** `13–17`, `Under 13`, or null for adults. Age is computed from stored month/year by the server. */
export const ageBandForAge = (age: number | null | undefined): string | null => {
  if (age == null) {
    return null;
  }
  if (age < 13) {
    return 'Under 13';
  }
  if (age < 18) {
    return '13–17';
  }
  return null;
};

export const relationshipLabel = (relationship: FamilyRelationship) => FAMILY_COPY.relationships[relationship];

export const memberInitials = (name: string) => name.replace(/\s+/g, '').slice(0, 2).toUpperCase();

export const canAddFamilyMember = (input: {
  name: string;
  relationship: FamilyRelationship | null;
  sex: 'male' | 'female' | null;
  birthMonth: number | null;
  birthYear: number | null;
}): boolean => {
  if (!input.name.trim() || !input.relationship || !input.sex) {
    return false;
  }
  if (input.relationship === 'child') {
    return input.birthMonth != null && input.birthYear != null;
  }
  return true;
};

/** Relationships offered in the Add family member sheet. The server accepts only spouse and child. */
export const FAMILY_RELATIONSHIP_CHOICES: FamilyRelationship[] = ['spouse', 'child'];

export const hasSpouse = (members: FamilyMember[]) => members.some((member) => member.relationship === 'spouse');
