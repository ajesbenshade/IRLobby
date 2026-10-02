import { useQuery } from '@tanstack/react-query';

import { FEATURES } from '@constants/features';
import { householdPatchSupported, type FamilyMember } from '@services/foyerService';

/**
 * Edit details and `Add day` need PATCH /api/users/household/<id>/ (Backend is adding it). `auto` asks the server with a
 * side-effect-free OPTIONS request against one real member; a 404/405/failed probe means the UI stays hidden. `on` / `off`
 * force it (EXPO_PUBLIC_FOYER_HOUSEHOLD_EDIT).
 */
export const HOUSEHOLD_EDIT_QUERY_KEY = ['foyer-household-edit-capability'] as const;

export const useHouseholdEditSupported = (members: FamilyMember[]): boolean => {
  const sampleId = members[0]?.id ?? null;
  const probe = FEATURES.householdEdit === 'auto' && sampleId != null;
  const query = useQuery({
    queryKey: [...HOUSEHOLD_EDIT_QUERY_KEY, sampleId],
    queryFn: () => householdPatchSupported(sampleId as number),
    enabled: probe,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  if (FEATURES.householdEdit === 'on') {
    return true;
  }
  if (FEATURES.householdEdit === 'off') {
    return false;
  }
  return probe && query.data === true;
};
