import * as fs from 'fs';
import * as path from 'path';

import { CHURCH_ADMIN_MAIL_SUBJECT, PRIVACY_URL, PRIVACY_VERSION, TERMS_URL, TERMS_VERSION } from '../churchAdmin';

const read = (relative: string) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8');

describe('church admin contact and legal fallbacks', () => {
  it('has no bundled church admin email anywhere in the app source', () => {
    for (const file of ['constants/churchAdmin.ts', 'services/appConfig.ts', 'components/FoyerProfileCard.tsx', 'components/foyer/SafetySheets.tsx']) {
      expect(read(file)).not.toContain('support@irlobby.com');
    }
    expect(CHURCH_ADMIN_MAIL_SUBJECT).toBe('The Foyer help');
  });

  it('falls back to the backend default Terms and Privacy pages', () => {
    expect(TERMS_URL).toBe('https://irlobby.com/terms');
    expect(PRIVACY_URL).toBe('https://irlobby.com/privacy');
    expect(TERMS_VERSION).toBeTruthy();
    expect(PRIVACY_VERSION).toBeTruthy();
  });

  it('is read by the Profile card through the app-config service', () => {
    const card = read('components/FoyerProfileCard.tsx');
    expect(card).toContain("from '@services/appConfig'");
    expect(card).not.toContain('mailto:');
  });

  it('no screen hardcodes a legal URL', () => {
    for (const file of ['screens/main/OnboardingScreen.tsx', 'screens/auth/RegisterScreen.tsx', 'screens/auth/LoginScreen.tsx']) {
      expect(read(file)).not.toMatch(/irlobby\.com\/(terms|privacy)/);
    }
  });
});
