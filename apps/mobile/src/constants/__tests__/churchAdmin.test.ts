import * as fs from 'fs';
import * as path from 'path';

import { CHURCH_ADMIN_CONTACT_URL } from '../churchAdmin';

describe('church admin contact', () => {
  it('is a single placeholder constant (still the support mailto until the real contact is known)', () => {
    expect(CHURCH_ADMIN_CONTACT_URL).toBe('mailto:support@irlobby.com?subject=The%20Foyer%20help');
  });

  it('is defined only in constants/churchAdmin.ts and imported by the Profile card', () => {
    const card = fs.readFileSync(path.join(__dirname, '../../components/FoyerProfileCard.tsx'), 'utf8');
    expect(card).toContain("from '@constants/churchAdmin'");
    expect(card).not.toMatch(/export const CHURCH_ADMIN_CONTACT_URL/);
    expect(card).not.toContain('mailto:');
  });
});
