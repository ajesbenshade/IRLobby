import * as fs from 'fs';
import * as path from 'path';

/**
 * Design QA pass on PR #37 (QA_PR37.md): guards for the values that are only visible in StyleSheets, so a
 * later edit cannot quietly bring back a 44pt target or cream text on burgundy.
 */
const read = (relative: string) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

describe('tap targets are at least 48pt', () => {
  it.each([
    ['screens/main/FoyerHostForm.tsx', /topButton: \{ minHeight: 48, minWidth: 48/],
    ['screens/main/FoyerHostForm.tsx', /checkRow: \{[^}]*minHeight: 56/],
    ['screens/main/GatheringChatScreen.tsx', /more: \{[^}]*minWidth: 48, minHeight: 48/],
    ['screens/main/FoyerGatherings.tsx', /chat: \{[^}]*minHeight: 48/],
    ['screens/main/FoyerGatherings.tsx', /segmentItem: \{ flex: 1, minHeight: 48/],
    ['screens/main/RequestsScreen.tsx', /tab: \{ flex: 1, minHeight: 48/],
    ['screens/auth/RegisterScreen.tsx', /legalRow: \{[^}]*minHeight: 48/],
  ])('%s %s', (file, pattern) => {
    expect(read(file)).toMatch(pattern);
  });
});

describe('text on burgundy is pure white', () => {
  it.each([
    ['components/SwipeActionButtons.tsx', /textColor: PILL_WHITE/],
    ['screens/main/GatheringDetailScreen.tsx', /statusChipText: \{ color: '#ffffff'/],
    ['screens/main/GatheringChatScreen.tsx', /bubbleTextMine: \{ color: '#ffffff' \}/],
    ['screens/main/DirectChatScreen.tsx', /bubbleTextMine: \{ color: '#ffffff' \}/],
    ['components/foyer/DatePickerSheet.tsx', /daySelectedText: \{ color: '#ffffff'/],
  ])('%s %s', (file, pattern) => {
    expect(read(file)).toMatch(pattern);
  });
});

describe('cancelled gathering', () => {
  const detail = read('screens/main/GatheringDetailScreen.tsx');

  it('uses the #f9e8ee banner with a bold #8a0a1f title and a greyscale cover', () => {
    expect(detail).toMatch(/bannerCancelled: \{ backgroundColor: '#f9e8ee' \}/);
    expect(detail).toMatch(/bannerTitleCancelled: \{[^}]*bodyBold[^}]*'#8a0a1f'/);
    expect(detail).toContain('GRAYSCALE_IMAGE_STYLE');
  });

  it('shows the Cancelled pill to every non-host viewer, and the going chip never to the host', () => {
    expect(detail).toMatch(/\{cancelled && !isHost \? \(/);
    expect(detail).toMatch(/\{isGoing && !isHost && !cancelled && !requestLocked \? \(/);
    expect(detail).not.toMatch(/Who was invited ·/);
  });

  it('keeps at least 24pt above Cancel this gathering (10 gap + 14 margin)', () => {
    expect(detail).toMatch(/cancelBlock: \{ gap: 6, marginTop: 14 \}/);
    expect(detail).toMatch(/container: \{ padding: 20, gap: 10/);
  });
});

describe('cleanup', () => {
  it('has no coral style names, Android storage permissions or old photo usage text', () => {
    for (const file of ['components/SocialAuthButton.tsx', 'screens/main/CreateActivityScreen.tsx']) {
      expect(read(file)).not.toMatch(/coral/i);
    }
    expect(read('../app.config.ts')).not.toMatch(/EXTERNAL_STORAGE/);
    expect(read('constants/foyerCopy.ts')).not.toContain('iosAddUsage');
  });

  it('keeps neutral "their" pronouns in the block and decline copy', () => {
    const copy = read('constants/foyerCopy.ts');
    expect(copy).toContain('Their messages are hidden.');
    expect(copy).toContain('in their notification');
  });
});
