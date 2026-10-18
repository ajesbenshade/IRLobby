/**
 * Church website calendar gate (mirrors apps/mobile/src/foyer/churchCalendar.ts).
 * Kept free of imports so the node tests can load it directly.
 */

/** Server flag on every church object (profile, login, /api/churches/). Missing = no website calendar. */
export type WebsiteCalendarFlags = {
  has_website_calendar?: boolean | null;
};

/** True only when `has_website_calendar` is exactly true; otherwise "Post to the church website calendar" is hidden. */
export const churchHasWebsiteCalendar = (church: WebsiteCalendarFlags | null | undefined): boolean =>
  church?.has_website_calendar === true;

/** What the form sends as `list_on_church_calendar`: never true when the church has no website calendar. */
export const listOnChurchCalendarValue = (churchHasCalendar: boolean, checked: boolean): boolean =>
  churchHasCalendar && checked;

/** Design copy for a 400 `{code: 'church_calendar_unavailable'}`. The server rejects the whole save, so the form stays open. */
export const CHURCH_CALENDAR_UNAVAILABLE_MESSAGE =
  "Your church's website calendar isn't connected to The Foyer yet. Turn off \u201cPost to the church website calendar\u201d and try again.";

/** apiRequest errors carry `status` and the parsed `body` (see lib/queryClient.ts throwIfResNotOk). */
export const isChurchCalendarUnavailable = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const { status, body } = error as { status?: unknown; body?: unknown };
  return (
    status === 400 &&
    Boolean(body) &&
    typeof body === 'object' &&
    (body as { code?: unknown }).code === 'church_calendar_unavailable'
  );
};
