import fs from 'fs';
import path from 'path';

import { memberRowLabel } from '../approval';
import { friendlyRsvpMessage } from '../logic';
import { ATTENDEE_COPY, APPROVAL_COPY, FAMILY_COPY, GOING_COPY } from '@constants/foyerCopy';

const src = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

describe('birthday privacy (Aaron, Oct 2)', () => {
  it('has no per-child share switch, flag, string or payload field anywhere', () => {
    expect(Object.keys(FAMILY_COPY)).not.toContain('showOnProfile');
    expect(Object.keys(FAMILY_COPY)).not.toContain('showOnProfileCaption');
    for (const file of [
      'components/foyer/AddFamilyMemberSheet.tsx',
      'components/foyer/FamilyMemberSheets.tsx',
      'screens/main/MyFamilyScreen.tsx',
      'foyer/family.ts',
      'foyer/birthdays.ts',
      'services/foyerService.ts',
      'constants/features.ts',
    ]) {
      const text = src(file);
      expect(text).not.toMatch(/childShare|showShare|showOnProfile|show_birthday.*(child|member)/i);
    }
    expect(src('foyer/birthdays.ts')).not.toMatch(/export const childShareSupported/);
  });

  it("family help text no longer promises sharing: 'Only you can see this.'", () => {
    expect(FAMILY_COPY.birthdayHelper).toBe('Only you can see this.');
  });

  it('hosts and guests see name + age band only: no relationship wording or birth data in host views', () => {
    expect('relationship' in APPROVAL_COPY).toBe(false);
    expect('relationship' in ATTENDEE_COPY).toBe(false);
    expect(memberRowLabel({ name: 'Mia', relationship: 'child', age_band: 'Under 13' } as never)).toBe('Age band: Under 13');
    expect(memberRowLabel({ name: 'Rachel', relationship: 'spouse', age_band: 'Adult' } as never)).not.toMatch(/spouse|child|parent|other/i);
    for (const file of ['components/foyer/HostAttendeesCard.tsx', 'screens/main/RequestsScreen.tsx', 'foyer/attendees.ts']) {
      expect(src(file)).not.toMatch(/date_of_birth|birth_day|birth_month|birth_year|formatBirthdayLong|Born /);
    }
  });

  it("'Born …' only appears in My family (list + its sheets) and the RSVP party picker", () => {
    const users = ['screens', 'components', 'foyer'].flatMap((dir) => {
      const walk = (target: string): string[] =>
        fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
          const full = path.join(target, entry.name);
          return entry.isDirectory() ? (entry.name === '__tests__' ? [] : walk(full)) : [full];
        });
      return walk(path.join(__dirname, '..', '..', dir));
    });
    const using = users.filter((file) => /FAMILY_COPY\.born|memberBirthLine|personSubtitle/.test(fs.readFileSync(file, 'utf8'))).map((file) => path.basename(file));
    expect(using.sort()).toEqual(['FamilyMemberSheets.tsx', 'MyFamilyScreen.tsx', 'family.ts', 'rsvp.ts']);
  });

  it('a server age-range rejection reads as a clear, neutral message', () => {
    expect(friendlyRsvpMessage('Some people are not eligible for this gathering.')).toBe(GOING_COPY.ageRangeRejected);
    expect(GOING_COPY.ageRangeRejected).toMatch(/age range/);
  });
});
