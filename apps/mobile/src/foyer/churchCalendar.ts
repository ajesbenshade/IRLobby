import axios from 'axios';

/** Server flags for "this church has a website calendar". Final name is `has_website_calendar`; `website_calendar` is also accepted. */
export type WebsiteCalendarFlags = {
  has_website_calendar?: boolean | null;
  website_calendar?: boolean | null;
};

/** True only when either flag is exactly `true`. Missing, null or false hides "Post to the church website calendar". */
export const churchHasWebsiteCalendar = (church: WebsiteCalendarFlags | null | undefined): boolean =>
  church?.has_website_calendar === true || church?.website_calendar === true;

/** Design copy for a 400 `{code: 'church_calendar_unavailable'}` on create/edit. */
export const CHURCH_CALENDAR_UNAVAILABLE_MESSAGE =
  "Your church's website calendar isn't connected to The Foyer yet. Your gathering is still posted in the app.";

export const isChurchCalendarUnavailable = (error: unknown): boolean => {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) {
    return false;
  }
  const data = error.response.data as { code?: unknown } | null | undefined;
  return Boolean(data && typeof data === 'object' && data.code === 'church_calendar_unavailable');
};
