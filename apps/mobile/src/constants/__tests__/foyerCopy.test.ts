import {
  ATTENDEE_COPY,
  CHAT_COPY,
  FAMILY_COPY,
  FRIEND_COPY,
  GOING_COPY,
  MEMBER_COPY,
  MESSAGING_COPY,
  PHOTO_COPY,
  PROFILE_COPY,
} from '../foyerCopy';
import { EVENT_PHOTOS_HELPER, MAX_EVENT_PHOTOS } from '../activity';

describe('final copy (Oct 1 late)', () => {
  it('photos', () => {
    expect(MAX_EVENT_PHOTOS).toBe(50);
    expect(EVENT_PHOTOS_HELPER).toBe('Up to 50 photos · JPEG/PNG/WebP');
    expect(PHOTO_COPY.uploadNotice).toBe('Photos you add can be viewed and saved by everyone who was at this gathering.');
    expect(PHOTO_COPY.progressTitle(12, 24)).toBe('Saving 12 of 24…');
    expect(PHOTO_COPY.savedToast(24)).toBe('Saved 24 photos to your library');
    expect(PHOTO_COPY.savedToast(1)).toBe('Saved 1 photo to your library');
    expect(PHOTO_COPY.cancelledToast(12, 24)).toBe('Download cancelled. 12 of 24 photos were saved.');
    expect(PHOTO_COPY.partialToast(22, 24)).toBe("Saved 22 of 24 photos. 2 couldn't be saved.");
  });
  it('going and family', () => {
    expect(GOING_COPY.cancelBody('Family Game Night')).toBe(
      'You and your family members will be removed from Family Game Night. This event will return to your Discover deck.',
    );
    expect(GOING_COPY.notEligible('ages 13–17')).toBe('Not eligible: ages 13–17');
    expect(FAMILY_COPY.intro).toBe('Add a spouse or child under 18 so you can RSVP for them. Only you can see this list.');
    expect(FAMILY_COPY.title).toBe('My family');
  });
  it('friends, profile, chat', () => {
    expect(FRIEND_COPY.cancelRequestBody('Maria')).toBe("Maria won't be told. You can send a new request later.");
    expect(MEMBER_COPY.privacyExplanation('Maria', 'phone')).toBe(
      "Maria's privacy settings let you see their profile. They chose to share their phone number.",
    );
    expect(MEMBER_COPY.blockBullets('Maria')).toHaveLength(4);
    expect(MEMBER_COPY.reportReasons).toHaveLength(5);
    expect(MESSAGING_COPY.minorTitle).toBe('Messages are friends only.');
    expect(PROFILE_COPY.visibilityHeading).toBe('Who can see my profile');
    expect(CHAT_COPY.mutedHeader('Maria K.')).toBe('Maria K. · Muted');
    expect(ATTENDEE_COPY.pastTitle(12)).toBe('Who was there · 12');
    expect(ATTENDEE_COPY.showMore(4)).toBe('Show 4 more going');
  });
});
