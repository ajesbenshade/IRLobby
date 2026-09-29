export type AudienceGender = 'everyone' | 'men' | 'women';

export const CHAT_GATE_MESSAGE = 'Chat opens for people who are going.';
export const FEE_NOTE = "Stripe's card fee applies. The Foyer takes no cut.";
export const CALENDAR_ADDRESS_WARNING =
  "Public events show their location on franconiamennonite.org. Don't list a home address unless you want the congregation to see it.";
export const WHOS_COMING_NOTE =
  'Only children in your household are listed. Teens with their own account RSVP for themselves.';

export type GatheringLike = {
  title?: string | null;
  audience?: string | null;
  audience_gender?: string | null;
  age_min?: number | null;
  age_max?: number | null;
  going_count?: number | null;
  participant_count?: number | null;
  cover_photo_url?: string | null;
  images?: string[] | null;
  host_name?: string | null;
  host_kind?: string | null;
  gift_disclaimer?: string | null;
  fee_note?: string | null;
  suggested_donation?: string | number | null;
  giving_available?: boolean | null;
  my_rsvp?: { status?: string; people_count?: number; include_self?: boolean } | null;
  description?: string | null;
  location?: string | null;
  time?: string | null;
};

export const audienceChipLabel = (activity: GatheringLike): string => {
  const provided = activity.audience?.trim();
  if (provided) return provided;
  const gender = activity.audience_gender ?? 'everyone';
  const who = gender === 'men' ? 'Men' : gender === 'women' ? 'Women' : 'Everyone';
  const min = activity.age_min ?? null;
  const max = activity.age_max ?? null;
  if (min != null && max == null && min >= 18) return `${who} · 18+`;
  if (min != null && max == null) return `${who} · Ages ${min}+`;
  if (min != null && max != null) return `${who} · Ages ${min}–${max}`;
  return who;
};

export const hostDisplayName = (activity: GatheringLike) => activity.host_name?.trim() || 'Host';

export const coverPhotoUrl = (activity: GatheringLike) =>
  activity.cover_photo_url?.trim() || activity.images?.find((item) => item?.trim()) || null;

export const giftIntro = (activity: GatheringLike) => {
  const title = activity.title?.trim() || 'this gathering';
  if (activity.host_kind === 'church') {
    return `The church is covering the meal for ${title}. A gift is optional and does not change your RSVP.`;
  }
  return `${hostDisplayName(activity)} is covering food for ${title}. A gift is optional and does not change your RSVP.`;
};

export const giftDisclaimer = (activity: GatheringLike) => {
  const provided = activity.gift_disclaimer?.trim();
  if (provided) return provided;
  if (activity.host_kind === 'church') return `Your gift goes to ${hostDisplayName(activity)}.`;
  return `This gift goes to ${hostDisplayName(activity)} directly. It is not a tax-deductible gift to Franconia Mennonite Church.`;
};

export const parseCapacity = (raw: string): { ok: true; capacity: number | null } | { ok: false; message: string } => {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, capacity: null };
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, message: 'Capacity must be a whole number from 1 to 500.' };
  }
  const value = Number(trimmed);
  if (value < 1 || value > 500) {
    return { ok: false, message: 'Capacity must be a whole number from 1 to 500.' };
  }
  return { ok: true, capacity: value };
};

export const whosGoingSummary = (peopleCount: number | null | undefined) => {
  const count = peopleCount ?? 1;
  if (count <= 1) return 'You';
  const children = count - 1;
  return children === 1 ? 'You + 1 child' : `You + ${children} children`;
};

export const isUpcomingGathering = (time?: string | null, now = new Date()) => {
  if (!time) return true;
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return true;
  return date.getTime() >= now.getTime();
};

export async function compressImageFile(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to prepare that photo.');
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
  if (!blob) {
    throw new Error('Unable to prepare that photo.');
  }
  return blob;
}
