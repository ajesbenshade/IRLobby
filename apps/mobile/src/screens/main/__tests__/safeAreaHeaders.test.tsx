import fs from 'fs';
import path from 'path';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { LegalWebViewSheet } from '@components/foyer/LegalWebViewSheet';

jest.mock('@hooks/useSafeInsets', () => ({ useSafeInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));

const src = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', '..', rel), 'utf8');

describe('safe-area audit: custom full-screen headers clear the status bar', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it('Terms / Privacy sheet header clears the status bar where the sheet is full screen (Android)', () => {
    Platform.OS = 'android';
    const view = render(<LegalWebViewSheet visible title="Terms" url="https://irlobby.com/terms" onClose={() => undefined} />);
    expect(StyleSheet.flatten(view.getByTestId('legal-header').props.style).paddingTop).toBe(47 + 14);
  });

  it('Terms / Privacy sheet keeps its normal header padding on an iOS page sheet', () => {
    Platform.OS = 'ios';
    const view = render(<LegalWebViewSheet visible title="Terms" url="https://irlobby.com/terms" onClose={() => undefined} />);
    expect(StyleSheet.flatten(view.getByTestId('legal-header').props.style).paddingTop).toBe(14);
  });

  it('the Direct message screen offsets its custom top bar by the top inset and the composer by the bottom inset', () => {
    const text = src('screens/main/DirectChatScreen.tsx');
    expect(text).toContain('useSafeInsets');
    expect(text).toMatch(/paddingTop: insets\.top \+ 8/);
    expect(text).toMatch(/insets\.bottom \+ 12/);
  });

  it('every full-screen photo / map surface reads the safe-area insets', () => {
    for (const file of ['screens/main/PhotoGalleryScreen.tsx', 'components/foyer/MapPickerSheet.tsx']) {
      expect(src(file)).toContain('useSafeInsets');
    }
  });
});
