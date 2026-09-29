import {
  APPLE_EVENT_ICS_PATH,
  CHURCH_CALENDAR_ICS_PATH,
  appleEventIcsUrl,
  churchCalendarSubscribeUrl,
  googleCalendarUrl,
  outlookCalendarUrl,
} from '@shared/calendarLinks';

const brunch = {
  title: "Women's Fall Brunch",
  start: '2026-10-17T13:30:00Z',
  end: '2026-10-17T15:00:00Z',
  location: 'Fellowship Hall, Franconia Mennonite Church',
  description: 'Egg casseroles, apple crisp, and good conversation.',
};

describe('calendar link builders', () => {
  it('builds a Google Calendar template from the gathering', () => {
    const url = new URL(googleCalendarUrl(brunch));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe("Women's Fall Brunch");
    expect(url.searchParams.get('dates')).toBe('20261017T133000Z/20261017T150000Z');
    expect(url.searchParams.get('details')).toBe(brunch.description);
    expect(url.searchParams.get('location')).toBe(brunch.location);
  });

  it('builds an Outlook compose link and fills a missing end with one hour', () => {
    const url = new URL(outlookCalendarUrl({ ...brunch, end: null }));
    expect(url.origin + url.pathname).toBe('https://outlook.live.com/calendar/0/deeplink/compose');
    expect(url.searchParams.get('rru')).toBe('addevent');
    expect(url.searchParams.get('subject')).toBe("Women's Fall Brunch");
    expect(url.searchParams.get('startdt')).toBe('2026-10-17T13:30:00Z');
    expect(url.searchParams.get('enddt')).toBe('2026-10-17T14:30:00Z');
    expect(url.searchParams.get('body')).toBe(brunch.description);
    expect(url.searchParams.get('location')).toBe(brunch.location);
  });

  it('stubs the Apple per-event file until the contract names it', () => {
    expect(APPLE_EVENT_ICS_PATH).toBe('/api/activities/{id}/calendar.ics');
    expect(appleEventIcsUrl('https://api.irlobby.com/', 17)).toBe(
      'https://api.irlobby.com/api/activities/17/calendar.ics',
    );
  });

  it('subscribes with webcal to the church calendar feed', () => {
    expect(CHURCH_CALENDAR_ICS_PATH).toBe('/api/public/calendar.ics');
    expect(churchCalendarSubscribeUrl('https://api.irlobby.com')).toBe(
      'webcal://api.irlobby.com/api/public/calendar.ics',
    );
    expect(churchCalendarSubscribeUrl('', 'https://irlobby.com')).toBe(
      'webcal://irlobby.com/api/public/calendar.ics',
    );
  });
});
