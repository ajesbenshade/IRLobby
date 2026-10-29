import type { ContactShare } from '@constants/foyerCopy';
import type { FriendRequestItem, Friendship, MemberProfile } from '@services/foyerService';

export const lastInitial = (name: string | null | undefined) => {
  const trimmed = (name ?? '').trim();
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}.` : '';
};

/** `Maria K.` needs a last initial the API does not give for friends; first name is shown as sent. */
export const friendDisplayName = (firstName: string) => firstName.trim();

export const filterFriends = <T extends { first_name: string }>(friends: T[], query: string): T[] => {
  const needle = query.trim().toLowerCase();
  return needle ? friends.filter((friend) => friend.first_name.toLowerCase().includes(needle)) : friends;
};

export const initialsFor = (name: string) => (name.trim().charAt(0) || '?').toUpperCase();

export type ProfileAction = 'add_friend' | 'request_sent' | 'message' | 'accept_request' | 'none';

export type ProfileView =
  | { state: 'blocked' }
  | {
      state: 'visible' | 'limited';
      action: ProfileAction;
      showFriendsCheck: boolean;
      showCancelRequest: boolean;
      showMessagingNote: boolean;
      showOverflow: boolean;
    };

/** 404 (null) means blocked either way or unreachable: plain state, no actions, no menu. */
export const profileView = (profile: MemberProfile | null): ProfileView => {
  if (!profile) {
    return { state: 'blocked' };
  }
  const friendship: Friendship = profile.friendship;
  const action: ProfileAction =
    friendship === 'friends'
      ? 'message'
      : friendship === 'pending_outgoing'
        ? 'request_sent'
        : friendship === 'pending_incoming'
          ? 'accept_request'
          : friendship === 'self'
            ? 'none'
            : 'add_friend';
  return {
    state: profile.visible ? 'visible' : 'limited',
    action,
    showFriendsCheck: friendship === 'friends',
    showCancelRequest: friendship === 'pending_outgoing',
    showMessagingNote: friendship === 'none' || friendship === 'pending_outgoing' || friendship === 'pending_incoming',
    // Report/Block on every visible member profile (never on your own).
    showOverflow: friendship !== 'self',
  };
};

/** Formatted mailing address, or null when the API omitted it. */
export const memberAddressText = (profile: {
  address?: string | { street?: string | null; street2?: string | null; city?: string | null; state?: string | null; postal?: string | null } | null;
}): string | null => {
  const value = profile.address;
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  const street = value.street?.trim() ?? '';
  const city = value.city?.trim() ?? '';
  if (!street || !city) {
    return null;
  }
  const street2 = value.street2?.trim() ?? '';
  const place = [city, [value.state?.trim(), value.postal?.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [street, street2, place].filter(Boolean).join('\n');
};

/** Which contact the viewer may see: only what the API returned (it omits keys unless opted in). */
export const contactKind = (
  profile: Pick<MemberProfile, 'email' | 'phone'> & { address?: string | null },
): ContactShare => {
  const hasPhone = Boolean(profile.phone);
  const hasEmail = Boolean(profile.email);
  const hasAddress = Boolean(profile.address?.trim());
  if (hasPhone && hasEmail && hasAddress) {
    return 'all';
  }
  if (hasPhone && hasEmail) {
    return 'both';
  }
  if (hasPhone && hasAddress) {
    return 'phone_address';
  }
  if (hasEmail && hasAddress) {
    return 'email_address';
  }
  if (hasPhone) {
    return 'phone';
  }
  if (hasEmail) {
    return 'email';
  }
  if (hasAddress) {
    return 'address';
  }
  return null;
};

export const splitRequests = (items: FriendRequestItem[]) => ({
  incoming: items.filter((item) => item.direction === 'incoming'),
  outgoing: items.filter((item) => item.direction === 'outgoing'),
});

/** The Message button needs an accepted friendship and a chat the server says can send. */
export const canMessage = (friendship: Friendship) => friendship === 'friends';

export const canStartDirectMessage = (input: { friendship: Friendship; isMinor: boolean; allowsEventDms: boolean }) =>
  input.friendship === 'friends' || (!input.isMinor && input.allowsEventDms);

export const requestErrorMessage = (status: number | undefined): string | null => {
  if (status === 429) {
    return 'You have sent a lot of requests. Please try again later.';
  }
  return null;
};
