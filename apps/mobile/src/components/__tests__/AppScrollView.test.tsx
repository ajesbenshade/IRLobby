import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { AppScrollView } from '@components/AppChrome';
import { getTabBarLayout } from '@navigation/tabBarLayout';
import { Text } from '@components/RNCompat';

const insets = { top: 59, bottom: 34, left: 0, right: 0 };

const paddingBottomOf = () => {
  const scroll = screen.UNSAFE_getByType(require('react-native').ScrollView);
  return StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom;
};

describe('AppScrollView bottom padding', () => {
  it('clears the floating tab bar when rendered inside the tab navigator', () => {
    render(
      <SafeAreaInsetsContext.Provider value={insets}>
        <BottomTabBarHeightContext.Provider value={84}>
          <AppScrollView>
            <Text>content</Text>
          </AppScrollView>
        </BottomTabBarHeightContext.Provider>
      </SafeAreaInsetsContext.Provider>,
    );

    expect(paddingBottomOf()).toBe(getTabBarLayout(insets.bottom, Dimensions.get('window').fontScale).scrollBottomPadding);
  });

  it('keeps the default padding for stack screens above the tabs', () => {
    render(
      <SafeAreaInsetsContext.Provider value={insets}>
        <AppScrollView>
          <Text>content</Text>
        </AppScrollView>
      </SafeAreaInsetsContext.Provider>,
    );

    expect(paddingBottomOf()).toBe(120);
  });
});
