import fs from 'fs';
import path from 'path';
import React from 'react';
import { Switch as NativeSwitch } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { CheckRow, CheckboxRow } from '../FoyerHostForm';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({}) }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const flat = (style: unknown) => Object.assign({}, ...(Array.isArray(style) ? style.flat(4) : [style]).filter(Boolean));
const source = fs.readFileSync(path.join(__dirname, '..', 'FoyerHostForm.tsx'), 'utf8');

describe('host form: calendar is a checkbox, approval and church stay switches', () => {
  it('"Post to the church website calendar" renders as a checkbox row (48pt, role checkbox, shared Checkbox), not a Switch', () => {
    const onChange = jest.fn();
    const view = render(<CheckboxRow label="Post to the church website calendar" value={false} onChange={onChange} testID="cal" />);
    const row = view.getByTestId('cal');
    expect(row.props.accessibilityRole).toBe('checkbox');
    expect(row.props.accessibilityState).toEqual({ checked: false });
    expect(flat(row.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(view.UNSAFE_queryByType(NativeSwitch)).toBeNull();
    const box = view.UNSAFE_getAllByType('View' as never).find((node) => flat(node.props.style).width === 22 && flat(node.props.style).height === 22);
    expect(flat(box?.props.style)).toMatchObject({ borderColor: '#857f7a', borderWidth: 2, backgroundColor: '#ffffff' });
    fireEvent.press(row);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('checked state fills burgundy with a tick and toggles back off', () => {
    const onChange = jest.fn();
    const view = render(<CheckboxRow label="Post to the church website calendar" value onChange={onChange} testID="cal" />);
    expect(view.getByTestId('cal').props.accessibilityState).toEqual({ checked: true });
    expect(view.UNSAFE_getByType('MaterialCommunityIcons' as never).props.name).toBe('check');
    fireEvent.press(view.getByTestId('cal'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('CheckRow is still a shared Switch row (Require approval, Allow asking again, Host as church)', () => {
    const view = render(<CheckRow label="Require approval" value={false} onChange={jest.fn()} />);
    expect(view.UNSAFE_getByType(NativeSwitch).props.trackColor).toEqual({ false: '#857f7a', true: '#a2033f' });
  });

  it('the form wires the calendar to CheckboxRow and the other three to CheckRow', () => {
    expect(source).toMatch(/<CheckboxRow\s+label="Post to the church website calendar"/);
    expect(source).not.toMatch(/<CheckRow\s+label="Post to the church website calendar"/);
    expect(source).toMatch(/<CheckRow label=\{APPROVAL_COPY\.toggleLabel\}/);
    expect(source).toMatch(/<CheckRow label=\{APPROVAL_COPY\.askAgainLabel\}/);
    expect(source).toMatch(/<CheckRow\s+label="Host as Franconia Mennonite Church"/);
  });
});
