import {
  CHURCH_CALENDAR_ICS_PATH,
  calendarEventSummary,
  calendarLinksFromActivity,
  churchCalendarFeedUrl,
  churchCalendarSubscribeUrl,
} from '@shared/calendarLinks';

const links = {
  ics_url: 'https://api.irlobby.com/api/activities/17/calendar.ics',
  webcal_url: 'webcal://api.irlobby.com/api/activities/17/calendar.ics',
  google_url: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Brunch',
  outlook_url: 'https://outlook.live.com/calendar/0/deeplink/compose?subject=Brunch',
};

describe('calendar links from the gathering', () => {
  it('reads Google and Outlook from calendar_links instead of building them', () => {
    expect(calendarLinksFromActivity({ calendar_links: links })).toEqual({
      google: links.google_url,
      outlook: links.outlook_url,
      apple: links.ics_url,
    });
  });

  it('uses the Apple webcal link when the ics file is absent', () => {
    expect(calendarLinksFromActivity({ calendar_links: { webcal_url: links.webcal_url } }).apple).toBe(
      links.webcal_url,
    );
    expect(calendarLinksFromActivity({}).google).toBeNull();
    expect(calendarLinksFromActivity({ calendar_links: { google_url: '  ' } }).google).toBeNull();
  });

  it('formats the sheet summary as title, weekday, and time', () => {
    expect(calendarEventSummary("Women's Fall Brunch", '2026-10-17T13:30:00.000Z')).toBe(
      "Women's Fall Brunch · Sat, Oct 17 · 9:30 AM",
    );
    expect(calendarEventSummary('Harvest Supper')).toBe('Harvest Supper');
  });

  it('builds the church subscribe and https copy links from one helper', () => {
    expect(CHURCH_CALENDAR_ICS_PATH).toBe('/api/public/calendar.ics');
    expect(churchCalendarFeedUrl('https://api.irlobby.com')).toBe(
      'https://api.irlobby.com/api/public/calendar.ics',
    );
    expect(churchCalendarSubscribeUrl('https://api.irlobby.com')).toBe(
      'webcal://api.irlobby.com/api/public/calendar.ics',
    );
    expect(churchCalendarSubscribeUrl('', 'https://irlobby.com')).toBe(
      'webcal://irlobby.com/api/public/calendar.ics',
    );
  });
});
