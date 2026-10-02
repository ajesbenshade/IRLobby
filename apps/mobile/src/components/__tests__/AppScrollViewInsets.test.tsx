import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { AppScrollView } from '../AppChrome';

jest.mock('@hooks/useSafeInsets', () => ({ useSafeInsets: () => ({ top: 28, bottom: 16, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const rootStyle = (view: ReturnType<typeof render>) => StyleSheet.flatten(view.getByTestId('app-scroll-root').props.style) as Record<string, unknown>;

describe('Android edge-to-edge: headerless screens clear the status bar themselves', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it('Android + headerless: adds the status-bar inset above the scroll content', () => {
    Platform.OS = 'android';
    const view = render(
      <AppScrollView headerless>
        <Text>My family</Text>
      </AppScrollView>,
    );
    expect(rootStyle(view).paddingTop).toBe(28);
  });

  it('Android + a stack screen WITH a native header: no extra padding (the header already clears it)', () => {
    Platform.OS = 'android';
    const view = render(
      <AppScrollView>
        <Text>Settings</Text>
      </AppScrollView>,
    );
    expect(rootStyle(view).paddingTop).toBeUndefined();
  });

  it('iOS: nothing added, contentInsetAdjustmentBehavior=automatic handles it', () => {
    Platform.OS = 'ios';
    const view = render(
      <AppScrollView headerless>
        <Text>My family</Text>
      </AppScrollView>,
    );
    expect(rootStyle(view).paddingTop).toBeUndefined();
  });

  it('every headerShown:false stack screen with a custom top row opts in', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    for (const file of ['MyFamilyScreen', 'MemberProfileScreen', 'MessagingScreen', 'FoyerFriendsScreen']) {
      const text = fs.readFileSync(path.join(__dirname, '..', '..', 'screens', 'main', `${file}.tsx`), 'utf8');
      const opens = (text.match(/<AppScrollView/g) ?? []).length;
      const flagged = (text.match(/<AppScrollView(\s+headerless|\s*\n\s*headerless)/g) ?? []).length;
      expect(flagged).toBe(opens);
    }
  });
});
