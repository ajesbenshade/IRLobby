import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

import { PillButton } from '../foyer/ui';
import { SocialAuthButton } from '../SocialAuthButton';
import { AppButton } from '../ui/Button';

describe('white-on-burgundy buttons always carry the burgundy fill', () => {
  it('AppButton contained: burgundy fill + white label, also when pressed and disabled', () => {
    const view = render(<AppButton onPress={jest.fn()}>Continue</AppButton>);
    const button = view.getByRole('button');
    expect(typeof button.props.style).not.toBe('function');
    expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe('#a2033f');
    expect(StyleSheet.flatten(view.getByText('Continue').props.style).color).toBe('#ffffff');
    fireEvent(button, 'pressIn');
    expect(StyleSheet.flatten(view.getByRole('button').props.style).backgroundColor).toBe('#800232');

    const disabled = render(<AppButton disabled>Nope</AppButton>);
    expect(StyleSheet.flatten(disabled.getByRole('button').props.style).backgroundColor).toBe('#a2033f');
  });

  it('AppButton quiet variants are not burgundy', () => {
    const view = render(<AppButton variant="outline">Pass</AppButton>);
    expect(StyleSheet.flatten(view.getByRole('button').props.style).backgroundColor).toBe('transparent');
  });

  it('SocialAuthButton email: burgundy fill + white label', () => {
    const view = render(<SocialAuthButton provider="email" label="Continue with email" onPress={jest.fn()} />);
    const button = view.getByRole('button');
    expect(typeof button.props.style).not.toBe('function');
    expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe('#a2033f');
    expect(StyleSheet.flatten(view.getByText('Continue with email').props.style).color).toBe('#ffffff');
  });

  it('PillButton primary: burgundy + white; disabled is grey with grey text (never white on grey)', () => {
    const on = render(<PillButton label="Confirm" onPress={jest.fn()} />);
    expect(StyleSheet.flatten(on.getByRole('button').props.style).backgroundColor).toBe('#a2033f');
    expect(StyleSheet.flatten(on.getByText('Confirm').props.style).color).toBe('#ffffff');
    const off = render(<PillButton label="Add" disabled />);
    expect(StyleSheet.flatten(off.getByRole('button').props.style).backgroundColor).toBe('#e1dbd7');
    expect(StyleSheet.flatten(off.getByText('Add').props.style).color).toBe('#7a7572');
  });
});
